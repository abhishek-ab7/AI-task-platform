# E2E Test Suite Infrastructure & Architecture

## Overview
This document describes the production-grade, opaque-box E2E test suite for the **AI Task Processing Platform**. The test suite validates end-to-end user authentication, task creation, Redis queueing, asynchronous worker string operations, rate limiting, security headers, container definitions (Dockerfiles/Compose), Kubernetes manifests, and ArgoCD GitOps deployment specs.

---

## Methodology & 4-Tier Test Architecture

The E2E Test Suite contains **63 comprehensive tests** partitioned into 4 distinct tiers:

### Tier 1: Feature Coverage (30 Tests)
Covers all primary features and happy paths across 6 domain areas (5 tests per domain):
1. **User Authentication (5 tests)**:
   - `T1_AUTH_01`: User registration via `POST /api/auth/register`
   - `T1_AUTH_02`: User login via `POST /api/auth/login` issuing valid JWT
   - `T1_AUTH_03`: JWT token structure and payload verification (`verifyJWTStructure`, `decodeJWT`)
   - `T1_AUTH_04`: Protected route access `GET /api/tasks` with valid JWT (200)
   - `T1_AUTH_05`: Protected route rejection `GET /api/tasks` without JWT (401)
2. **Task Creation & Queueing (5 tests)**:
   - `T1_TASK_01`: `POST /api/tasks` creates task record
   - `T1_TASK_02`: Task schema structure validation (`taskId`, `operationType`, `inputText`, `status`)
   - `T1_TASK_03`: Redis queue `ai_task_queue` receiving enqueued task payload
   - `T1_TASK_04`: Task persistence & retrieval by ID `GET /api/tasks/:id`
   - `T1_TASK_05`: Task list retrieval `GET /api/tasks`
3. **Operation Types (5 tests)**:
   - `T1_OP_01`: `UPPERCASE` transformation & `Success` status
   - `T1_OP_02`: `LOWERCASE` transformation & `Success` status
   - `T1_OP_03`: `REVERSE_STRING` transformation & `Success` status
   - `T1_OP_04`: `WORD_COUNT` transformation & `Success` status
   - `T1_OP_05`: Timestamped execution log inspection
4. **Rate Limiting & Security Headers (5 tests)**:
   - `T1_SEC_01`: Helmet header `x-dns-prefetch-control: off`
   - `T1_SEC_02`: Helmet header `x-frame-options: SAMEORIGIN` or `DENY`
   - `T1_SEC_03`: Helmet header `x-content-type-options: nosniff`
   - `T1_SEC_04`: Helmet header `strict-transport-security`
   - `T1_SEC_05`: Rate limiter 429 response on request burst
5. **Dockerfiles & Compose Validations (5 tests)**:
   - `T1_DOCKER_01`: Frontend Dockerfile multi-stage build check
   - `T1_DOCKER_02`: Backend Dockerfile non-root user check
   - `T1_DOCKER_03`: Worker Dockerfile non-root user check
   - `T1_DOCKER_04`: Docker Compose service definitions check
   - `T1_DOCKER_05`: Docker Compose persistent volume mounts check
6. **K8s & ArgoCD Validations (5 tests)**:
   - `T1_K8S_01`: K8s Namespace, Deployments, Services check
   - `T1_K8S_02`: K8s Ingress, ConfigMaps, Secrets check
   - `T1_K8S_03`: K8s Liveness & Readiness probes check
   - `T1_K8S_04`: K8s Resource requests/limits and HPA check
   - `T1_K8S_05`: ArgoCD Application manifest structure & auto-sync check (`automated.prune`, `automated.selfHeal`)

---

### Tier 2: Boundary & Corner Cases (25 Tests)
Validates edge cases, invalid inputs, error handling, rate limiting burst, and container security anti-patterns across 5 domains (5 tests per domain):
1. **Auth Edge Cases (5 tests)**:
   - `T2_AUTH_01`: Duplicate email registration rejection (400/409)
   - `T2_AUTH_02`: Invalid password login rejection (401)
   - `T2_AUTH_03`: Malformed JWT header rejection (401)
   - `T2_AUTH_04`: Expired/invalid JWT signature rejection (401)
   - `T2_AUTH_05`: Missing required fields on auth endpoints rejection (400)
2. **Task Creation Edge Cases (5 tests)**:
   - `T2_TASK_01`: Empty `inputText` handling / rejection (400)
   - `T2_TASK_02`: 100KB+ extra-large `inputText` handling
   - `T2_TASK_03`: Invalid `operationType` rejection (400)
   - `T2_TASK_04`: Missing title or input text validation (400)
   - `T2_TASK_05`: Injection prevention in task input
3. **Operation Edge Cases (5 tests)**:
   - `T2_OP_01`: Unicode and emoji string transformations
   - `T2_OP_02`: Multiline strings with newlines/tabs handling
   - `T2_OP_03`: Single-word string input for `WORD_COUNT`
   - `T2_OP_04`: Special characters handling in `REVERSE_STRING`
   - `T2_OP_05`: Whitespace-only string handling for `WORD_COUNT`
4. **Rate Limit Burst (5 tests)**:
   - `T2_RATE_01`: Rapid consecutive request burst
   - `T2_RATE_02`: HTTP 429 status response verification
   - `T2_RATE_03`: Rate limit response headers (`retry-after`, `x-ratelimit-limit`)
   - `T2_RATE_04`: Rate limit window reset verification
   - `T2_RATE_05`: Static asset / health route non-blocking verification
5. **Container & K8s Edge Cases (5 tests)**:
   - `T2_K8S_01`: Audit check for missing non-root USER in Dockerfiles
   - `T2_K8S_02`: Audit check for missing liveness/readiness probes in K8s
   - `T2_K8S_03`: Audit check for missing CPU/memory limits in K8s
   - `T2_K8S_04`: Audit check for unpinned `:latest` image tag detection
   - `T2_K8S_05`: Audit check for missing Secret/ConfigMap key references

---

### Tier 3: Cross-Feature Combinations (5 Tests)
Validates multi-step integrations and pipeline interaction:
1. `T3_COMB_01`: Auth -> Task Creation -> Redis Queue integration
2. `T3_COMB_02`: Task Creation -> Worker Processing -> Log Retrieval
3. `T3_COMB_03`: Security + Auth Rate Limit Isolation (auth bucket vs task bucket)
4. `T3_COMB_04`: K8s Manifests + ArgoCD Integration (selector matching & auto-sync policy)
5. `T3_COMB_05`: Multi-Operation Sequential Pipeline execution under single auth session

---

### Tier 4: Real-World Scenarios (3 Tests)
Complex end-to-end workflows and benchmark simulations:
1. `T4_REAL_01`: Full E2E Task Lifecycle Simulation
2. `T4_REAL_02`: Complete Repository Static & Manifest Security/Architecture Audit
3. `T4_REAL_03`: High Task Volume Simulation & Throughput Benchmark (100 parallel tasks)

---

## Standalone Mock Server Architecture
The test suite includes an autonomous, built-in mock server in `e2e_tests/utils/helpers.js`.
- Implemented purely using Node.js standard `http` module with zero external dependencies.
- Handles full routing for `/api/auth/register`, `/api/auth/login`, `/api/tasks`, `/api/tasks/:id`, `/health`.
- Simulates Redis queue `ai_task_queue` and async worker processing.
- Automatically started on port 5050 by `run_tests.js` and cleanly torn down when tests complete.

---

## Execution Guide

### Run All Tiers (63 Tests)
```bash
node e2e_tests/run_tests.js
```
or via npm:
```bash
npm test --prefix e2e_tests
```

### Run Specific Tier
```bash
node e2e_tests/run_tests.js --tier=1
node e2e_tests/run_tests.js --tier=2
node e2e_tests/run_tests.js --tier=3
node e2e_tests/run_tests.js --tier=4
```
