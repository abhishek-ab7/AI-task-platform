# **Assessment** 

### **In-Office Role | Minimum 2 Years of Experience**

---

# **Technical Assignment**

## **Objective**

Design, develop, containerize, and deploy a production-ready AI Task Processing Platform using the MERN Stack, a Python background worker, Docker, Kubernetes (k3s is acceptable), Argo CD (GitOps), and a complete CI/CD  pipeline.

This assignment is designed to evaluate your ability to build scalable, production-grade applications while following modern DevOps and software engineering best practices.

# **Project Overview**

Build a web application that enables authenticated users to create AI processing tasks, execute  them asynchronously, and monitor their execution status and results.

# **Functional Requirements**

### **User Authentication**

Implement secure user authentication with the following features:

* User Registration  
* User Login  
* JWT-based Authentication  
* Password hashing using bcrypt

### **Task Management**

Authenticated users should be able to:

* Create a new AI task  
* Provide:  
  * Task Title  
  * Input Text  
  * Operation Type  
* Execute the task asynchronously  
* View task status  
* View execution logs  
* View processed results

# **Supported Operations**

**Your worker service must support the following operations:**

| Operation | Description |
| ----- | ----- |
| Uppercase | Convert all characters to uppercase |
| Lowercase | Convert all characters to lowercase |
| Reverse String | Reverse the input string |
| Word Count | Return the total number of words |

# **Task Processing Workflow**

**The application should follow the workflow below:**

| Step | Description |
| ----- | ----- |
| **1** | **User clicks Run Task** |
| **2** | **Backend creates a task record with status Pending** |
| **3** | **Task is pushed to a Redis queue** |
| **4** | **Python Worker consumes the task** |
| **5** | **Status changes to Running** |
| **6** | **Worker processes the operation** |
| **7** | **Result and execution logs are saved** |
| **8** | **Final status becomes Success or Failed** |

---

# **Required Technology Stack**

| Component | Technology |
| ----- | ----- |
| **Frontend** | **React.js or Next.js** |
| **Backend API** | **Node.js \+ Express.js** |
| **Background Worker** | **Python** |
|  |  |
| **Database** | **MongoDB** |
| **Queue** | **Redis** |
| **Containerization** | **Docker** |
| **Authentication** | **JWT** |
| **Orchestration** | **Kubernetes (k3s allowed)** |
| **GitOps** | **Argo CD** |

---

# **Docker Requirements**

Your solution must include:

* Separate Dockerfile for:  
  * Frontend  
  * Backend  
  * Worker  
* Multi-stage Docker builds  
* Containers running as a non-root user  
* Docker Compose configuration for local development

# **Kubernetes Requirements**

Deploy the complete application using Kubernetes.

Your deployment should include:

| Requirement | Status |
| ----- | ----- |
| **Dedicated Namespace** | **Required** |
| **Deployment for each component** | **Required** |
| **Service for each component** | **Required** |
| **Ingress Configuration** | **Required** |
| **ConfigMaps** | **Required** |
| **Secrets** | **Required** |
| **Resource Requests** | **Required** |
| **Resource Limits** | **Required** |
| **Liveness Probes** | **Required** |
| **Readiness Probes** | **Required** |
| **Worker Scaling Support** | **Required** |

---

# **GitOps Requirements (Argo CD)**

Implement GitOps deployment using Argo CD.

Requirements include:

* Create a separate Infrastructure Repository  
* Store Kubernetes manifests inside the Infrastructure Repository  
* Install and configure Argo CD  
* Enable automatic synchronization (Auto Sync)  
* Provide a screenshot of the Argo CD Dashboard

# **CI/CD Requirements**

**Your CI/CD pipeline should perform the following:**

| Pipeline Step | Required |
| ----- | ----- |
| **Run Lint Checks** | **Yes** |
| **Build Docker Images** | **Yes** |
| **Push Images to Docker Hub or another Container Registry** | **Yes** |
| **Automatically update image tags in the Infrastructure Repository** | **Yes** |

---

# **Security Requirements**

Implement the following security best practices:

* Password hashing using bcrypt  
* JWT Authentication  
* Helmet Middleware  
* API Rate Limiting  
* No hardcoded secrets in the repository  
* Use Kubernetes Secrets or Environment Variables for sensitive configuration

# **Architecture Documentation (Mandatory)**

Prepare an architecture document of 2–4 pages covering the following topics:

1. Overall system architecture  
2. Worker scaling strategy  
3. Handling high task volume (approximately 100000, tasks/day)  
4. MongoDB indexing strategy  
5. Redis failure handling and recovery strategy  
6. Deployment strategy for:  
   * Staging Environment  
   * Production Environment

# **Submission Requirements**

**Please submit the following:**

| Deliverable | Required |
| ----- | ----- |
| **Application Repository** | **Yes** |
| **Infrastructure Repository** | **Yes** |
| **Live Deployment URL (if available)** | **Preferred** |
| **Argo CD Dashboard Screenshot** | **Yes** |
| **Architecture Document (2–4 Pages)** | **Yes** |
| **README with Complete Setup Instructions** | **Yes** |

# **Evaluation Criteria**

**Your submission will be evaluated based on:**

| Criteria | Focus Areas |
| ----- | ----- |
| **Code Quality** | **Clean architecture, maintainability, readability** |
| **MERN Development** | **API design, frontend implementation, database modeling** |
| **Asynchronous Processing** | **Redis queue implementation, worker execution** |
| **Docker** | **Image optimization, multi-stage builds, security** |
| **Kubernetes** | **Production-ready deployment configuration** |
| **GitOps** | **Argo CD configuration and repository structure** |
| **CI/CD** | **Automation and deployment workflow** |
| **Security** | **Authentication, authorization, secrets management** |
| **Documentation** | **Architecture clarity and setup instructions** |

# 

# 

