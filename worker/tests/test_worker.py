import json
import threading
import time
from unittest.mock import MagicMock, patch, call
import pytest

import config
import db
import processor
import worker


# --- Config Tests ---
def test_config_defaults():
    assert config.REDIS_URL == "redis://localhost:6379/0"
    assert config.MONGODB_URI == "mongodb://localhost:27017"
    assert config.QUEUE_NAME == "ai_task_queue"
    assert config.DB_NAME == "ai_task_db"
 

# --- DB Helper Tests ---
@patch("db.MongoClient")
def test_db_helpers(mock_mongo_client):
    mock_client_instance = MagicMock()
    mock_mongo_client.return_value = mock_client_instance
    mock_db = MagicMock()
    mock_client_instance.__getitem__.return_value = mock_db
    mock_collection = MagicMock()
    mock_db.__getitem__.return_value = mock_collection

    client = db.get_mongo_client()
    assert client == mock_client_instance
    mock_mongo_client.assert_called_with("mongodb://localhost:27017")

    database = db.get_db()
    assert database == mock_db

    tasks_col = db.get_tasks_collection(mock_db)
    assert tasks_col == mock_collection


# --- Processor Tests ---
def test_processor_uppercase():
    result = processor.process_task("UPPERCASE", "hello world")
    assert result == "HELLO WORLD"


def test_processor_lowercase():
    result = processor.process_task("LOWERCASE", "HELLO WORLD")
    assert result == "hello world"


def test_processor_reverse_string():
    result = processor.process_task("REVERSE_STRING", "abcdef")
    assert result == "fedcba"


def test_processor_word_count():
    result = processor.process_task("WORD_COUNT", "apple banana apple cherry")
    assert result["wordCount"] == 4
    assert result["uniqueWords"] == 3
    assert result["frequencies"] == {"apple": 2, "banana": 1, "cherry": 1}


def test_processor_unsupported_operation():
    with pytest.raises(ValueError) as excinfo:
        processor.process_task("INVALID_OP", "test")
    assert "Unsupported operation type: INVALID_OP" in str(excinfo.value)


# --- Worker Process Single Task Tests ---
def test_process_single_task_success():
    mock_collection = MagicMock()
    payload = {
        "taskId": "task-123",
        "userId": "user-456",
        "operationType": "UPPERCASE",
        "inputText": "test input",
        "createdAt": "2026-07-23T10:00:00Z",
    }

    res = worker.process_single_task(payload, db_or_tasks_collection=mock_collection)

    assert res["status"] == "Success"
    assert res["result"] == "TEST INPUT"
    assert res["taskId"] == "task-123"

    assert mock_collection.update_one.call_count == 2

    # First call: set status to Running, push INFO log
    first_call_args = mock_collection.update_one.call_args_list[0]
    assert {"taskId": "task-123"} in first_call_args[0][0]["$or"]
    assert first_call_args[0][1]["$set"]["status"] == "Running"
    assert first_call_args[0][1]["$push"]["logs"]["level"] == "INFO"
    assert first_call_args[0][1]["$push"]["logs"]["message"] == "Task started processing"

    # Second call: set status to Success, push INFO log, set result
    second_call_args = mock_collection.update_one.call_args_list[1]
    assert {"taskId": "task-123"} in second_call_args[0][0]["$or"]
    assert second_call_args[0][1]["$set"]["status"] == "Success"
    assert second_call_args[0][1]["$set"]["result"] == "TEST INPUT"
    assert second_call_args[0][1]["$push"]["logs"]["level"] == "INFO"
    assert second_call_args[0][1]["$push"]["logs"]["message"] == "Task completed successfully"


def test_process_single_task_failure():
    mock_collection = MagicMock()
    payload = {
        "taskId": "task-999",
        "operationType": "INVALID_OP",
        "inputText": "fail test",
    }

    res = worker.process_single_task(payload, db_or_tasks_collection=mock_collection)

    assert res["status"] == "Failed"
    assert res["result"] is None
    assert "Unsupported operation type" in res["error"]

    assert mock_collection.update_one.call_count == 2

    # Second call: set status to Failed, set result to None, push ERROR log
    second_call_args = mock_collection.update_one.call_args_list[1]
    assert second_call_args[0][1]["$set"]["status"] == "Failed"
    assert second_call_args[0][1]["$set"]["result"] is None
    assert second_call_args[0][1]["$push"]["logs"]["level"] == "ERROR"
    assert "Unsupported operation type: INVALID_OP" in second_call_args[0][1]["$push"]["logs"]["message"]


def test_process_single_task_json_string_payload():
    mock_collection = MagicMock()
    payload_dict = {
        "taskId": "task-json-1",
        "operationType": "REVERSE_STRING",
        "inputText": "python",
    }
    payload_json = json.dumps(payload_dict)

    res = worker.process_single_task(payload_json, db_or_tasks_collection=mock_collection)
    assert res["status"] == "Success"
    assert res["result"] == "nohtyp"


def test_process_single_task_invalid_json_with_task_id():
    mock_collection = MagicMock()
    invalid_raw = '{"taskId": "task-bad-json", "operationType": "UPPERCASE", broken_json}'

    res = worker.process_single_task(invalid_raw, db_or_tasks_collection=mock_collection)
    assert res["status"] == "Failed"
    assert res["taskId"] == "task-bad-json"
    assert "Invalid JSON" in res["error"]

    first_call_args = mock_collection.update_one.call_args_list[0]
    assert first_call_args[0][1]["$set"]["status"] == "Failed"
    assert first_call_args[0][1]["$push"]["logs"]["level"] == "ERROR"


def test_process_single_task_invalid_json_without_task_id():
    mock_collection = MagicMock()
    invalid_raw = "completely invalid text without task id"

    with pytest.raises(ValueError) as excinfo:
        worker.process_single_task(invalid_raw, db_or_tasks_collection=mock_collection)
    assert "Invalid JSON payload" in str(excinfo.value)


def test_process_single_task_missing_task_id():
    mock_collection = MagicMock()
    payload = {"operationType": "UPPERCASE", "inputText": "no id"}

    with pytest.raises(ValueError) as excinfo:
        worker.process_single_task(payload, db_or_tasks_collection=mock_collection)
    assert "Missing taskId in payload" in str(excinfo.value)


# --- Worker Loop & Reconnect Tests ---
@patch("redis.Redis.from_url")
@patch("db.get_tasks_collection")
def test_start_worker_loop_and_reconnect(mock_get_tasks_col, mock_redis_from_url):
    import redis

    mock_collection = MagicMock()
    mock_get_tasks_col.return_value = mock_collection

    mock_redis_client = MagicMock()
    mock_redis_from_url.return_value = mock_redis_client

    payload = json.dumps({"taskId": "t-1", "operationType": "LOWERCASE", "inputText": "ABC"})

    # First call throws Redis ConnectionError, second call returns item, then stop event set
    mock_redis_client.blpop.side_effect = [
        redis.ConnectionError("Redis down"),
        ("ai_task_queue", payload.encode("utf-8")),
    ]

    stop_event = threading.Event()

    def run_worker():
        worker.start_worker(stop_event=stop_event)

    t = threading.Thread(target=run_worker)
    t.start()

    # Let the worker execute two iterations
    time.sleep(2.5)
    stop_event.set()
    t.join(timeout=3)

    assert mock_collection.update_one.call_count >= 2
    # Verify Redis reconnect attempt was made
    assert mock_redis_from_url.call_count >= 2
