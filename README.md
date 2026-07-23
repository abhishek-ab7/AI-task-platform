# Production-Ready AI Task Processing Platform (MERN Stack + Python Worker)

A scalable, containerized, production-grade AI Task Processing Platform built using the **MERN Stack** (MongoDB, Express.js, React.js, Node.js), a **Python background worker**, **Redis queue**, **Docker**, **Kubernetes (k3s)**, **Argo CD (GitOps)**, and **GitHub Actions CI/CD**.

---

## 🌟 Key Features

* 🔐 **User Authentication**: Secure user registration and login with bcrypt password hashing and JWT token authentication.
* ⚡ **Asynchronous Task Processing**: Decoupled Express.js task producer pushing AI tasks into a Redis queue consumed by stateless Python workers.
* 🛠️ **Supported AI Operations**:
  * `UPPERCASE`: Converts input text to uppercase.
  * `LOWERCASE`: Converts input text to lowercase.
  * `REVERSE_STRING`: Reverses input text.
  * `WORD_COUNT`: Returns total word count and details.
* 📊 **Real-time Status & Execution Logs**: Dynamic React dashboard with auto-polling (every 3 seconds), status badges (`Pending`, `Running`, `Success`, `Failed`), and detailed execution log modal.
* 🛡️ **Production Security**: Helmet middleware, API rate limiting, non-root Docker container security, and environment secret injection.
* 🐳 **Containerization**: Optimized multi-stage Docker builds for Frontend, Backend, and Worker, plus single-command `docker-compose` setup.
* ☸️ **Kubernetes & GitOps**: Dedicated namespace, ConfigMaps, Secrets, Liveness/Readiness probes, HPA auto-scaling, and Argo CD GitOps integration.

---

## 🏗️ Repository Architecture & Directory Structure

```
.
├── ARCHITECTURE.md              # 2-4 Page Technical Architecture Document
├── Mern Full Stack Assignment.md # Assignment Specification Document
├── docker-compose.yml           # Single-command local environment setup
├── .github/
│   └── workflows/
│       └── ci-cd.yml            # CI/CD Pipeline (Lint, Test, Build, Push, GitOps tag update)
├── backend/                     # Node.js + Express.js API Gateway
│   ├── Dockerfile               # Multi-stage non-root Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── app.js               # Express application setup
│   │   ├── index.js             # Server startup
│   │   ├── config/              # Redis & Mongoose connections
│   │   ├── controllers/         # Auth & Task controllers
│   │   ├── middleware/          # JWT Auth, Rate Limiter, Helmet
│   │   ├── models/              # User & Task Mongo schemas
│   │   └── routes/              # Auth & Task API routes
│   └── tests/                   # Jest API test suite (17/17 passing)
├── worker/                      # Python Async Worker Service
│   ├── Dockerfile               # Multi-stage non-root Dockerfile
│   ├── config.py                # Environment configuration
│   ├── db.py                    # PyMongo database handler
│   ├── processor.py             # Supported AI operation handlers
│   ├── worker.py                # Redis queue consumer loop
│   └── tests/                   # Pytest worker test suite (14/14 passing)
├── frontend/                    # React.js Single Page Application
│   ├── Dockerfile               # Multi-stage Nginx non-root Dockerfile
│   ├── nginx.conf               # Nginx reverse proxy configuration
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── index.css            # Dark mode glassmorphism design system
│       ├── components/          # Navbar, TaskModal
│       ├── pages/               # AuthPage, DashboardPage
│       └── services/            # API fetch layer
├── k8s/                         # Production Kubernetes Manifests
│   ├── 00-namespace.yaml        # Dedicated ai-task-platform namespace
│   ├── 01-configmap.yaml        # ConfigMaps
│   ├── 02-secret.yaml           # Secrets
│   ├── 03-mongodb.yaml          # MongoDB deployment & service
│   ├── 04-redis.yaml            # Redis deployment & service
│   ├── 05-backend.yaml          # Backend deployment & service
│   ├── 06-worker.yaml           # Worker deployment
│   ├── 07-frontend.yaml         # Frontend deployment & service
│   ├── 08-ingress.yaml          # Nginx ingress routing
│   └── 09-hpa.yaml              # Worker HorizontalPodAutoscaler
└── argocd/                      # Argo CD GitOps Integration
    └── application.yaml         # Auto-Sync Argo CD Application manifest
```

---

## 🚀 Quickstart: Local Development with Docker Compose

Ensure Docker and Docker Compose are installed on your machine.

1. **Clone the repository**:
   ```bash
   git clone <repository_url>
   cd habit-tracker
   ```

2. **Start the application stack**:
   ```bash
   docker-compose up --build
   ```

3. **Access the application services**:
   * **Frontend UI**: [http://localhost:3000](http://localhost:3000)
   * **Backend API**: [http://localhost:5000](http://localhost:5000)
   * **MongoDB**: `localhost:27017`
   * **Redis**: `localhost:6379`

---

## 🧪 Running Automated Unit & Integration Tests

### 1. Backend Tests (Node.js / Express / Jest)
```bash
cd backend
npm install
npm test
```
*Output: 17/17 tests passing.*

### 2. Worker Tests (Python / Pytest)
```bash
cd worker
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt pytest
PYTHONPATH=. pytest
```
*Output: 14/14 tests passing.*

---

## ☸️ Production Deployment on Kubernetes (k3s / minikube)

To deploy the entire production stack into a Kubernetes cluster:

1. **Apply all Kubernetes manifests**:
   ```bash
   kubectl apply -f k8s/00-namespace.yaml
   kubectl apply -f k8s/
   ```

2. **Verify Pod & Service Status**:
   ```bash
   kubectl get pods -n ai-task-platform
   kubectl get svc -n ai-task-platform
   kubectl get ingress -n ai-task-platform
   kubectl get hpa -n ai-task-platform
   ```

---

## 🔄 GitOps Continuous Deployment with Argo CD

1. **Install Argo CD on your cluster**:
   ```bash
   kubectl create namespace argocd
   kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
   ```

2. **Apply the Application manifest with Auto-Sync enabled**:
   ```bash
   kubectl apply -f argocd/application.yaml
   ```

3. **Check Synchronization Status**:
   ```bash
   argocd app get ai-task-platform-app
   ```

---

## 🔒 Security Best Practices Implemented

* **Password Hashing**: Passwords stored using `bcrypt` salted hashes.
* **Stateless Token Auth**: Protected endpoints secured via `JWT` Authorization header.
* **API Security Middleware**: `Helmet` headers and Express `express-rate-limit`.
* **Container Security**: Multi-stage builds running under unprivileged non-root users (`node`, `appuser`, `nginx`).
* **Zero Hardcoded Secrets**: All DB connections, ports, and JWT secret keys injected via ConfigMaps/Secrets.

---

## 📄 License & Assignment Submission

Submitted as part of the MERN Full Stack Technical Assignment. See `ARCHITECTURE.md` for in-depth system design analysis.
