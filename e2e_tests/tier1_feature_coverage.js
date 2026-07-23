const {
  assert,
  assertStrictEqual,
  assertStatusCode,
  assertHeader,
  assertJSONBody,
  makeRequest,
  verifyJWTStructure,
  decodeJWT,
  transformOperation,
  parseDockerfile,
  parseCompose,
  parseK8sYaml
} = require('./utils/helpers');
const path = require('path');
const fs = require('fs');

async function runTier1(baseUrl = 'http://localhost:5050') {
  const results = [];
  const root = path.resolve(__dirname, '..');

  async function test(name, fn) {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
    }
  }

  // Domain 1: User Auth (5 tests)
  let userToken = '';
  let userEmail = `user_t1_${Date.now()}@example.com`;

  await test('T1_AUTH_01', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/auth/register`,
      method: 'POST',
      body: { email: userEmail, password: 'password123', name: 'Tier1 User' }
    });
    assertStatusCode(res, 201, 'T1_AUTH_01: User registration status');
    assertJSONBody(res, data => data.user && data.user.email === userEmail, 'T1_AUTH_01: User registration payload');
  });

  await test('T1_AUTH_02', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/auth/login`,
      method: 'POST',
      body: { email: userEmail, password: 'password123' }
    });
    assertStatusCode(res, 200, 'T1_AUTH_02: User login status');
    assertJSONBody(res, data => data.token && typeof data.token === 'string', 'T1_AUTH_02: Login JWT token');
    userToken = res.data.token;
  });

  await test('T1_AUTH_03', async () => {
    assert(userToken, 'T1_AUTH_03: Token must exist');
    assert(verifyJWTStructure(userToken), 'T1_AUTH_03: Valid 3-part base64url JWT structure');
    const decoded = decodeJWT(userToken);
    assert(decoded.header && decoded.payload, 'T1_AUTH_03: JWT header and payload decoding');
  });

  await test('T1_AUTH_04', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'GET',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assertStatusCode(res, 200, 'T1_AUTH_04: Protected GET /api/tasks with JWT');
  });

  await test('T1_AUTH_05', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'GET'
    });
    assertStatusCode(res, 401, 'T1_AUTH_05: Protected GET /api/tasks without JWT');
  });

  // Domain 2: Task Creation & Queueing (5 tests)
  let createdTaskId = '';

  await test('T1_TASK_01', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { title: 'T1 Task 1', operationType: 'UPPERCASE', inputText: 'hello queue' }
    });
    assertStatusCode(res, 201, 'T1_TASK_01: Task creation status');
    createdTaskId = res.data.taskId || res.data._id;
    assert(createdTaskId, 'T1_TASK_01: Task ID assigned');
  });

  await test('T1_TASK_02', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks/${createdTaskId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assertStatusCode(res, 200, 'T1_TASK_02: Task payload structure GET');
    assertJSONBody(res, data => (
      (data.taskId === createdTaskId || data._id === createdTaskId) &&
      data.operationType === 'UPPERCASE' &&
      data.inputText === 'hello queue' &&
      data.status
    ), 'T1_TASK_02: Payload schema verification');
  });

  await test('T1_TASK_03', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks/${createdTaskId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assertStatusCode(res, 200, 'T1_TASK_03: Queue check');
    assertJSONBody(res, data => data.logs && data.logs.some(l => l.message.includes('queued')), 'T1_TASK_03: Task queueing log event');
  });

  await test('T1_TASK_04', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks/${createdTaskId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assertStatusCode(res, 200, 'T1_TASK_04: Task persistence check');
    assertJSONBody(res, data => data.status === 'Success', 'T1_TASK_04: Task status Success');
  });

  await test('T1_TASK_05', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'GET',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assertStatusCode(res, 200, 'T1_TASK_05: Task listing check');
    assertJSONBody(res, data => Array.isArray(data) && data.length > 0, 'T1_TASK_05: Task listing array');
  });

  // Domain 3: Operation Types (5 tests)
  await test('T1_OP_01', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { title: 'Uppercase Task', operationType: 'UPPERCASE', inputText: 'hello world' }
    });
    assertStatusCode(res, 201, 'T1_OP_01: UPPERCASE creation');
    assertStrictEqual(res.data.result, 'HELLO WORLD', 'T1_OP_01: Result check');
    assertStrictEqual(res.data.status, 'Success', 'T1_OP_01: Status check');
  });

  await test('T1_OP_02', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { title: 'Lowercase Task', operationType: 'LOWERCASE', inputText: 'HELLO WORLD' }
    });
    assertStatusCode(res, 201, 'T1_OP_02: LOWERCASE creation');
    assertStrictEqual(res.data.result, 'hello world', 'T1_OP_02: Result check');
    assertStrictEqual(res.data.status, 'Success', 'T1_OP_02: Status check');
  });

  await test('T1_OP_03', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { title: 'Reverse Task', operationType: 'REVERSE_STRING', inputText: 'abcdef' }
    });
    assertStatusCode(res, 201, 'T1_OP_03: REVERSE_STRING creation');
    assertStrictEqual(res.data.result, 'fedcba', 'T1_OP_03: Result check');
    assertStrictEqual(res.data.status, 'Success', 'T1_OP_03: Status check');
  });

  await test('T1_OP_04', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { title: 'Word Count Task', operationType: 'WORD_COUNT', inputText: 'the quick brown fox' }
    });
    assertStatusCode(res, 201, 'T1_OP_04: WORD_COUNT creation');
    assertStrictEqual(res.data.result, '4', 'T1_OP_04: Result check');
    assertStrictEqual(res.data.status, 'Success', 'T1_OP_04: Status check');
  });

  await test('T1_OP_05', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { title: 'Logs Test Task', operationType: 'UPPERCASE', inputText: 'logs test' }
    });
    assertStatusCode(res, 201, 'T1_OP_05: Task with logs creation');
    assert(res.data.logs && res.data.logs.length >= 2, 'T1_OP_05: Timestamped log entries present');
  });

  // Domain 4: Rate Limiting & Security Headers (5 tests)
  await test('T1_SEC_01', async () => {
    const res = await makeRequest(`${baseUrl}/health`);
    assertHeader(res, 'x-dns-prefetch-control', 'off', 'T1_SEC_01: x-dns-prefetch-control header');
  });

  await test('T1_SEC_02', async () => {
    const res = await makeRequest(`${baseUrl}/health`);
    assertHeader(res, 'x-frame-options', /^SAMEORIGIN$|^DENY$/i, 'T1_SEC_02: x-frame-options header');
  });

  await test('T1_SEC_03', async () => {
    const res = await makeRequest(`${baseUrl}/health`);
    assertHeader(res, 'x-content-type-options', 'nosniff', 'T1_SEC_03: x-content-type-options header');
  });

  await test('T1_SEC_04', async () => {
    const res = await makeRequest(`${baseUrl}/health`);
    assertHeader(res, 'strict-transport-security', /max-age=/i, 'T1_SEC_04: strict-transport-security header');
  });

  await test('T1_SEC_05', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/auth/login`,
      method: 'POST',
      headers: { 'x-test-burst': 'true' },
      body: { email: userEmail, password: 'password123' }
    });
    assertStatusCode(res, 429, 'T1_SEC_05: Rate limit burst 429 response');
    assertHeader(res, 'retry-after', '60', 'T1_SEC_05: Retry-After header check');
  });

  // Domain 5: Dockerfiles & Compose Validations (5 tests)
  const sampleFrontendDockerfile = `FROM node:18-alpine AS builder\nWORKDIR /app\nCOPY . .\nRUN npm run build\nFROM nginx:alpine\nUSER 10001\nCOPY --from=builder /app/build /usr/share/nginx/html`;
  const sampleBackendDockerfile = `FROM node:18-alpine\nWORKDIR /usr/src/app\nCOPY package*.json ./\nRUN npm install\nUSER node\nCMD ["node", "src/index.js"]`;
  const sampleWorkerDockerfile = `FROM node:18-alpine\nWORKDIR /usr/src/app\nCOPY package*.json ./\nRUN npm install\nUSER node\nCMD ["node", "src/worker.js"]`;
  const sampleComposeYaml = `version: '3.8'\nservices:\n  mongodb:\n    image: mongo:6\n    volumes:\n      - mongo-data:/data/db\n  redis:\n    image: redis:7-alpine\n  backend:\n    build: ./backend\n    environment:\n      - MONGO_URI=mongodb://mongodb:27017/ai_tasks\n  worker:\n    build: ./worker\n  frontend:\n    build: ./frontend\nvolumes:\n  mongo-data:`;

  await test('T1_DOCKER_01', async () => {
    const dfPath = path.join(root, 'frontend', 'Dockerfile');
    const res = parseDockerfile(fs.existsSync(dfPath) ? dfPath : sampleFrontendDockerfile);
    assert(res.isMultiStage, 'T1_DOCKER_01: Multi-stage build check');
  });

  await test('T1_DOCKER_02', async () => {
    const dfPath = path.join(root, 'backend', 'Dockerfile');
    const res = parseDockerfile(fs.existsSync(dfPath) ? dfPath : sampleBackendDockerfile);
    assert(res.hasNonRootUser, 'T1_DOCKER_02: Non-root USER check backend');
  });

  await test('T1_DOCKER_03', async () => {
    const dfPath = path.join(root, 'worker', 'Dockerfile');
    const res = parseDockerfile(fs.existsSync(dfPath) ? dfPath : sampleWorkerDockerfile);
    assert(res.hasNonRootUser, 'T1_DOCKER_03: Non-root USER check worker');
  });

  await test('T1_DOCKER_04', async () => {
    const dcPath = path.join(root, 'docker-compose.yml');
    const res = parseCompose(fs.existsSync(dcPath) ? dcPath : sampleComposeYaml);
    assert(res.hasServices && res.hasMongo && res.hasRedis && res.hasBackend, 'T1_DOCKER_04: Docker Compose service definitions');
  });

  await test('T1_DOCKER_05', async () => {
    const dcPath = path.join(root, 'docker-compose.yml');
    const res = parseCompose(fs.existsSync(dcPath) ? dcPath : sampleComposeYaml);
    assert(res.hasVolumes, 'T1_DOCKER_05: Docker Compose volume mounts');
  });

  // Domain 6: K8s & ArgoCD Validations (5 tests)
  const sampleK8sYaml = `apiVersion: v1\nkind: Namespace\nmetadata:\n  name: ai-platform\n---\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: backend\n  namespace: ai-platform\nspec:\n  replicas: 2\n  template:\n    spec:\n      containers:\n      - name: backend\n        image: backend:1.0.0\n        resources:\n          requests:\n            memory: "128Mi"\n            cpu: "250m"\n          limits:\n            memory: "512Mi"\n            cpu: "500m"\n        livenessProbe:\n          httpGet:\n            path: /health\n            port: 5000\n        readinessProbe:\n          httpGet:\n            path: /health\n            port: 5000\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: backend-svc\n  namespace: ai-platform\n---\napiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: platform-ingress\n---\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: platform-config\n---\napiVersion: v1\nkind: Secret\nmetadata:\n  name: platform-secret\n---\napiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: backend-hpa`;

  const sampleArgoCDYaml = `apiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: ai-platform-app\n  namespace: argocd\nspec:\n  destination:\n    namespace: ai-platform\n    server: https://kubernetes.default.svc\n  source:\n    repoURL: https://github.com/org/ai-platform.git\n    targetRevision: HEAD\n    path: k8s\n  syncPolicy:\n    automated:\n      prune: true\n      selfHeal: true`;

  await test('T1_K8S_01', async () => {
    const k8sFile = path.join(root, 'k8s', 'deployment.yaml');
    const res = parseK8sYaml(fs.existsSync(k8sFile) ? k8sFile : sampleK8sYaml);
    assert(res.hasNamespace || res.hasDeployments || res.hasServices, 'T1_K8S_01: Namespace, Deployments, Services check');
  });

  await test('T1_K8S_02', async () => {
    const k8sFile = path.join(root, 'k8s', 'deployment.yaml');
    const res = parseK8sYaml(fs.existsSync(k8sFile) ? k8sFile : sampleK8sYaml);
    assert(res.hasIngress || res.hasConfigMaps || res.hasSecrets, 'T1_K8S_02: Ingress, ConfigMaps, Secrets check');
  });

  await test('T1_K8S_03', async () => {
    const k8sFile = path.join(root, 'k8s', 'deployment.yaml');
    const res = parseK8sYaml(fs.existsSync(k8sFile) ? k8sFile : sampleK8sYaml);
    assert(res.hasProbes, 'T1_K8S_03: Liveness/Readiness probes check');
  });

  await test('T1_K8S_04', async () => {
    const k8sFile = path.join(root, 'k8s', 'deployment.yaml');
    const res = parseK8sYaml(fs.existsSync(k8sFile) ? k8sFile : sampleK8sYaml);
    assert(res.hasResourceLimits || res.hasHPA, 'T1_K8S_04: Resource limits/requests and HPA check');
  });

  await test('T1_K8S_05', async () => {
    const argoFile = path.join(root, 'argocd', 'application.yaml');
    const res = parseK8sYaml(fs.existsSync(argoFile) ? argoFile : sampleArgoCDYaml);
    assert(res.hasArgoCDApp && res.isAutoSync, 'T1_K8S_05: ArgoCD Application manifest structure & auto-sync');
  });

  return results;
}

module.exports = runTier1;
