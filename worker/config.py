import os
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
MONGODB_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI") or "mongodb://localhost:27017"
QUEUE_NAME = os.getenv("QUEUE_NAME", "ai_task_queue")
DB_NAME = os.getenv("DB_NAME", "ai_task_db")
