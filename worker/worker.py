import json
import re
import time
from datetime import datetime, timezone
import redis
import config
import db
import processor


def process_single_task(payload_raw_or_dict, db_or_tasks_collection=None):
    if db_or_tasks_collection is None:
        collection = db.get_tasks_collection()
    elif hasattr(db_or_tasks_collection, "update_one"):
        collection = db_or_tasks_collection
    elif hasattr(db_or_tasks_collection, "__getitem__"):
        collection = db_or_tasks_collection["tasks"]
    else:
        collection = db_or_tasks_collection

    if isinstance(payload_raw_or_dict, (bytes, str)):
        raw_str = payload_raw_or_dict.decode("utf-8") if isinstance(payload_raw_or_dict, bytes) else payload_raw_or_dict
        try:
            payload = json.loads(raw_str)
        except Exception as e:
            match = re.search(r'"taskId"\s*:\s*"([^"]+)"', raw_str)
            if match:
                task_id = match.group(1)
                now_iso = datetime.now(timezone.utc).isoformat()
                query = {"$or": [{"taskId": task_id}, {"_id": task_id}]}
                if collection is not None:
                    collection.update_one(
                        query,
                        {
                            "$set": {"status": "Failed", "result": None},
                            "$push": {
                                "logs": {
                                    "timestamp": now_iso,
                                    "level": "ERROR",
                                    "message": f"Error: Invalid JSON payload - {str(e)}",
                                }
                            },
                        },
                    )
                return {"taskId": task_id, "status": "Failed", "result": None, "error": f"Invalid JSON: {e}"}
            raise ValueError(f"Invalid JSON payload: {e}")
    elif isinstance(payload_raw_or_dict, dict):
        payload = payload_raw_or_dict
    else:
        raise ValueError(f"Invalid payload format: {type(payload_raw_or_dict)}")

    task_id = payload.get("taskId") or payload.get("id") or payload.get("_id")
    user_id = payload.get("userId")
    operation_type = payload.get("operationType")
    input_text = payload.get("inputText")
    created_at = payload.get("createdAt")

    if not task_id:
        raise ValueError("Missing taskId in payload")

    try:
        from bson.objectid import ObjectId
        obj_id = ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id
    except Exception:
        obj_id = task_id

    query = {"$or": [{"taskId": task_id}, {"_id": task_id}, {"_id": obj_id}]}

    # 1. Update status to Running
    now_iso = datetime.now(timezone.utc).isoformat()
    if collection is not None:
        collection.update_one(
            query,
            {
                "$set": {"status": "Running"},
                "$push": {
                    "logs": {
                        "timestamp": now_iso,
                        "level": "INFO",
                        "message": "Task started processing",
                    }
                },
            },
        )

    # 2. Process task
    try:
        result = processor.process_task(operation_type, input_text)
        now_iso = datetime.now(timezone.utc).isoformat()
        if collection is not None:
            collection.update_one(
                query,
                {
                    "$set": {"status": "Success", "result": result},
                    "$push": {
                        "logs": {
                            "timestamp": now_iso,
                            "level": "INFO",
                            "message": "Task completed successfully",
                        }
                    },
                },
            )
        return {"taskId": task_id, "status": "Success", "result": result}
    except Exception as e:
        now_iso = datetime.now(timezone.utc).isoformat()
        if collection is not None:
            collection.update_one(
                query,
                {
                    "$set": {"status": "Failed", "result": None},
                    "$push": {
                        "logs": {
                            "timestamp": now_iso,
                            "level": "ERROR",
                            "message": f"Error: {str(e)}",
                        }
                    },
                },
            )
        return {"taskId": task_id, "status": "Failed", "result": None, "error": str(e)}


def start_worker(stop_event=None):
    tasks_collection = db.get_tasks_collection()

    redis_client = None
    while stop_event is None or not stop_event.is_set():
        try:
            if redis_client is None:
                redis_client = redis.Redis.from_url(config.REDIS_URL)

            item = redis_client.blpop(config.QUEUE_NAME, timeout=1)
            if item:
                queue_name, raw_payload = item
                payload_str = raw_payload.decode("utf-8") if isinstance(raw_payload, bytes) else raw_payload
                process_single_task(payload_str, tasks_collection)
        except (redis.ConnectionError, redis.RedisError) as e:
            redis_client = None
            time.sleep(1)
        except Exception as e:
            time.sleep(1)


if __name__ == "__main__":
    start_worker()
