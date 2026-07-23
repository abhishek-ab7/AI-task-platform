# Infrastructure Repository (GitOps K8s Manifests)

This repository contains production Kubernetes (k3s) manifests and Argo CD GitOps configuration for the **AI Task Processing Platform**.

## Repository Layout

```
.
├── argocd/
│   └── application.yaml       # Argo CD Application manifest with Auto-Sync
└── k8s/                       # Kubernetes Manifests
    ├── 00-namespace.yaml      # Dedicated ai-task-platform namespace
    ├── 01-configmap.yaml      # Environment variables ConfigMap
    ├── 02-secret.yaml         # Sensitive database & JWT credentials
    ├── 03-mongodb.yaml        # MongoDB StatefulSet/Deployment & Service
    ├── 04-redis.yaml          # Redis Deployment & Service
    ├── 05-backend.yaml        # Express API Deployment (2 Replicas, Non-Root) & Service
    ├── 06-worker.yaml         # Python Worker Deployment (Non-Root, Resource Limits)
    ├── 07-frontend.yaml       # React SPA Nginx Deployment (2 Replicas, Non-Root) & Service
    ├── 08-ingress.yaml        # Nginx Ingress routing (/api -> backend, / -> frontend)
    └── 09-hpa.yaml            # Worker HorizontalPodAutoscaler (2 to 20 replicas)
```

## Quick Deploy via kubectl

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/
```

## Deploy via Argo CD GitOps

```bash
kubectl apply -f argocd/application.yaml
```
