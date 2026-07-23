# Architecture & System Design Document
## Production-Ready Asynchronous AI Task Processing Platform

---

## 1. Overall System Architecture

The AI Task Processing Platform is designed as a distributed, decoupled, microservice-based architecture capable of running CPU-bound and I/O-bound AI background processes at high scale. 

### Architecture Component Diagram

```
 +-------------------------------------------------------------------------+
 |                               Client Layer                              |
 |   +-----------------------------------------------------------------+   |
 |   |          React.js Single Page Application (SPA / Nginx)          |   |
 |   +-----------------------------------------------------------------+   |
 +-----------------------------------||------------------------------------+
                                     || HTTP / REST / JWT
                                     \/
 +-------------------------------------------------------------------------+
 |                               API Gateway                               |
 |   +-----------------------------------------------------------------+   |
 |   |                  Kubernetes Ingress (Nginx)                     |   |
 |   +-----------------------------------------------------------------+   |
 +-----------------------------------||------------------------------------+
                                     ||
                                     \/
 +-------------------------------------------------------------------------+
 |                         Application Tier (Stateless)                    |
 |   +-----------------------------------------------------------------+   |
 |   |          Node.js / Express API Service (2-10 Replicas)          |   |
 |   |      - User Auth (bcrypt, JWT) & Route Protection                 |   |
 |   |      - Task Ingestion & Status Query Endpoints                  |   |
 |   |      - Helmet Security & Rate Limiting                          |   |
 |   +------------------------||------------------------||--------------+   |
 +----------------------------||------------------------||-----------------+
                              || Producer               || Persistence
                              \/                        \/
 +---------------------------------------+   +-----------------------------+
 |          Messaging & Queue            |   |       Database Tier         |
 |   +-------------------------------+   |   |   +---------------------+   |
 |   |    Redis 7.0 In-Memory Queue  |   |   |   | MongoDB 6.0 Cluster |   |
 |   |   (BLPOP / RPUSH / Persistent)|   |   |   | (Tasks & Users)     |   |
 |   +-------------------------------+   |   |   +---------------------+   |
 +-------------------+-------------------+   +--------------^--------------+
                     |                                      |
                     | Consumer (BLPOP)                     | Status Update
                     \/                                     | & Logs Write
 +----------------------------------------------------------+--------------+
 |                        Background Execution Tier                        |
 |   +-----------------------------------------------------------------+   |
 |   |               Python Background Workers (HPA Scaled)            |   |
 |   |   - Operates Uppercase, Lowercase, Reverse String, Word Count   |   |
 |   |   - Robust Retry, Exception Handling, Structured Logging        |   |
 |   +-----------------------------------------------------------------+   |
 +-------------------------------------------------------------------------+
```

### End-to-End Task Lifecycle Sequence
1. **Authentication & Task Creation**: User authenticates via JWT. The user submits an AI task (`title`, `inputText`, `operationType`) to Express `/api/tasks`.
2. **Database Ingestion**: Express creates a MongoDB task document with status `Pending` and initial structured log entry.
3. **Queue Push**: Express executes `RPUSH ai_task_queue payload` into Redis.
4. **Worker Dequeue**: Python background workers continuously pull from Redis using blocking command `BLPOP ai_task_queue 1`.
5. **State Transition**: Worker updates task status in MongoDB to `Running` via atomic `$set` and appends log entry to `logs` array.
6. **Execution**: Python `processor.py` processes the specified operation (`UPPERCASE`, `LOWERCASE`, `REVERSE_STRING`, `WORD_COUNT`).
7. **Completion & Persist**: Worker updates MongoDB document status to `Success` (or `Failed`) with result payload and completion timestamps.
8. **Client Polling/Subscription**: Frontend receives updated state during periodic auto-refresh, rendering execution status, output, and logs.

---

## 2. Worker Scaling Strategy

To efficiently handle dynamic workloads and avoid resource contention:

1. **Stateless Worker Design**: Python background worker containers store no state locally. All state changes are committed directly to MongoDB and Redis.
2. **Kubernetes Horizontal Pod Autoscaler (HPA)**:
   - Scales worker pods automatically between `2` (minimum baseline) and `20` (peak burst) based on CPU (`>75%`) and Memory utilization (`>80%`).
   - Custom Metric Scaling (KEDA / Redis Metric): When configured with KEDA, HPA monitors `redis_db_keys` or length of `ai_task_queue`. If queue size exceeds 50 pending items, HPA provisions additional worker pods immediately.
3. **Graceful Shutdown & Signal Handling**:
   - Python workers catch `SIGTERM` / `SIGINT` signals from K8s during downscaling.
   - Currently processing tasks are finished before pod termination, preventing task truncation.

---

## 3. High Task Volume Strategy (~100,000 Tasks / Day)

### Volume Metrics Calculation
$$\text{Tasks per Day} = 100,000$$
$$\text{Average Throughput} = \frac{100,000}{86,400 \text{ sec}} \approx 1.16 \text{ tasks/sec}$$
$$\text{Peak Burst Capacity (10x Factor)} \approx 12-15 \text{ tasks/sec}$$

### System Optimizations for Scale
1. **Connection Pooling**:
   - **MongoDB**: Express & Python Workers maintain persistent connection pools (`maxPoolSize=50`).
   - **Redis**: Redis connection pool reused across worker cycles to reduce TCP handshake overhead.
2. **Redis In-Memory Speed**:
   - `RPUSH` / `BLPOP` operations run in $O(1)$ constant time complexity, handling up to $100,000+$ ops/second on minimal hardware.
3. **Database Write Optimization**:
   - Status updates write directly via indexed `$set` and `$push` queries in MongoDB without full document replacements.

---

## 4. MongoDB Indexing Strategy

To guarantee sub-millisecond query latencies across growing collections:

### Index Definitions & Design Rationale
1. **User Lookup**:
   - `{ email: 1 }` (`unique: true`) for $O(1)$ authentication query during user login.
2. **User Task List & Sorting**:
   - Compound Index: `{ userId: 1, createdAt: -1 }`
   - *Rationale*: Solves query filtering by `userId` sorted descending by `createdAt`. Prevents expensive in-memory MongoDB sorting (`SORT_KEY_GENERATOR`).
3. **Worker Processing Lookup**:
   - Compound Index: `{ _id: 1, status: 1 }`
   - *Rationale*: Allows Python worker to instantly update running status by task ID.
4. **Log Cleanups (TTL Index)**:
   - Single Field TTL Index on completed tasks: `{ createdAt: 1 }` with `expireAfterSeconds: 2592000` (30 days).

---

## 5. Redis Failure Handling & Recovery Strategy

To ensure zero task loss during network partitions or Redis node restarts:

1. **Persistence (RDB + AOF)**:
   - `appendonly yes` with `appendfsync everysec` for maximum data safety with minimal disk latency.
   - Periodic RDB snapshots (`save 900 1`) for fast system reboots.
2. **Reliable Queue Pattern (RPOPLPUSH / LMOVE)**:
   - For critical production, `LMOVE ai_task_queue ai_task_processing` transfers tasks atomically to a processing queue.
   - If a worker dies mid-task, an automated cleanup cron inspects orphaned tasks in `ai_task_processing` and re-queues them.
3. **Dead-Letter Queue (DLQ)**:
   - If a task fails 3 consecutive retries due to malformed payload or execution exception, worker routes it to `ai_task_dlq` for operator inspection.

---

## 6. Staging vs Production Deployment Strategy

```
+-----------------------------------------------------------------------------------+
|                                 Git Repository                                    |
|       +----------------------------+        +-----------------------------+       |
|       |   staging branch -> CI/CD  |        |    main branch -> CI/CD      |       |
|       +--------------||------------+        +--------------||-------------+       |
+----------------------||------------------------------------||---------------------+
                       \/                                    \/
+------------------------------------------+ +--------------------------------------+
|            Staging Cluster               | |          Production Cluster          |
|  Namespace: ai-task-staging              | |  Namespace: ai-task-platform         |
|  Argo CD: Auto-Sync Enabled              | |  Argo CD: Auto-Sync + Manual Approval|
|  Replicas: 1 Backend, 1 Worker           | |  Replicas: 3+ Backend, 3-20 Worker  |
|  DB: Single Node Mongo / Redis            | |  DB: Replica Set Mongo / Sentinel  |
+------------------------------------------+ +--------------------------------------+
```

| Dimension | Staging Environment | Production Environment |
| --- | --- | --- |
| **Namespace** | `ai-task-staging` | `ai-task-platform` |
| **Domain & SSL** | `staging.aitask.internal` (Self-signed) | `app.aitask.com` (Let's Encrypt / TLS Cert Manager) |
| **Replicas** | Backend: 1, Worker: 1 | Backend: 3+, Worker: 3–20 (HPA) |
| **Database** | Standalone MongoDB & Redis | MongoDB Replica Set (3 nodes) & Redis Sentinel/Cluster |
| **Deployment Rollout** | Immediate Auto-Sync | Blue-Green / Canary Rollout with Argo Rollouts |
| **Secrets Management** | K8s Secrets / SealedSecrets | HashiCorp Vault / AWS Secrets Manager Sync |
