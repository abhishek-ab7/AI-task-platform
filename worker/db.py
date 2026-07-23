from pymongo import MongoClient
import config


def get_mongo_client(uri=None):
    if uri is None:
        uri = config.MONGODB_URI
    return MongoClient(uri)


def get_db(uri=None, db_name=None):
    if db_name is None:
        db_name = config.DB_NAME
    client = get_mongo_client(uri)
    return client[db_name]


def get_tasks_collection(db=None):
    if db is None:
        db = get_db()
    return db["tasks"]
