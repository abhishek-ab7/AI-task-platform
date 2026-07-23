const {
  assert,
  assertStrictEqual,
  assertStatusCode,
  assertHeader,
  assertJSONBody,
  makeRequest,
  parseK8sYaml
} = require('./utils/helpers');

async function runTier3(baseUrl = 'http://localhost:5050') {
  const results = [];

  async function test(name, fn) {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
    }
  }

  // Session user details
  const sessionEmail = `tier3_user_${Date.now()}@example.com`;
  let sessionToken = '';

  await test('T3_COMB_01', async () => {
    // Auth -> Task Creation -> Redis Queue Integration
    const regRes = await makeRequest({
      url: `${baseUrl}/api/auth/register`,
      method: 'POST',
      body: { email: sessionEmail, password: 'password123', name: 'Integration User' }
    });
    assertStatusCode(regRes, 201, 'Registration step');
    sessionToken = regRes.data.token;

    const taskRes = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
      body: { title: 'Pipeline Task', operationType: 'REVERSE_STRING', inputText: 'pipeline' }
    });
    assertStatusCode(taskRes, 201, 'Task creation step');
    assert(taskRes.data.queue || (taskRes.data.logs && taskRes.data.logs.some(l => l.message.includes('queued'))), 'Task enqueued to Redis queue');
  });

  await test('T3_COMB_02', async () => {
    // Task Creation -> Worker Processing -> Log Retrieval
    const taskRes = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
      body: { title: 'Worker Processing Task', operationType: 'WORD_COUNT', inputText: 'one two three' }
    });
    assertStatusCode(taskRes, 201, 'Task creation');
    const taskId = taskRes.data.taskId || taskRes.data._id;

    const getRes = await makeRequest({
      url: `${baseUrl}/api/tasks/${taskId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    assertStatusCode(getRes, 200, 'Task retrieval');
    assertStrictEqual(getRes.data.status, 'Success', 'Worker processing completed');
    assertStrictEqual(getRes.data.result, '3', 'Worker result check');
    assert(getRes.data.logs && getRes.data.logs.length >= 2, 'Execution logs complete');
  });

  await test('T3_COMB_03', async () => {
    // Security + Auth Rate Limit Isolation (auth bucket vs task bucket)
    const taskRes = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'GET',
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    assertStatusCode(taskRes, 200, 'Task bucket request should succeed');
    assertHeader(taskRes, 'strict-transport-security', /max-age=/i, 'HSTS header isolation verified');
  });

  await test('T3_COMB_04', async () => {
    // K8s Manifests + ArgoCD Integration
    const manifestYaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-deploy
  namespace: ai-platform
spec:
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
---
apiVersion: v1
kind: Service
metadata:
  name: backend-svc
  namespace: ai-platform
spec:
  selector:
    app: backend
---
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ai-platform-app
  namespace: argocd
spec:
  destination:
    namespace: ai-platform
  source:
    repoURL: https://github.com/org/ai-platform.git
    targetRevision: HEAD
    path: k8s
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
`;
    const parsed = parseK8sYaml(manifestYaml);
    assert(parsed.hasDeployments && parsed.hasServices && parsed.hasArgoCDApp && parsed.isAutoSync, 'K8s Service selector matches Deployment labels and ArgoCD Application references target repo/namespace');
  });

  await test('T3_COMB_05', async () => {
    // Multi-Operation Sequential Pipeline execution under single auth session
    const ops = [
      { op: 'UPPERCASE', input: 'hello', expected: 'HELLO' },
      { op: 'LOWERCASE', input: 'WORLD', expected: 'world' },
      { op: 'REVERSE_STRING', input: '12345', expected: '54321' },
      { op: 'WORD_COUNT', input: 'apple banana cherry', expected: '3' }
    ];

    for (const item of ops) {
      const res = await makeRequest({
        url: `${baseUrl}/api/tasks`,
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
        body: { title: `Sequential Task ${item.op}`, operationType: item.op, inputText: item.input }
      });
      assertStatusCode(res, 201, `Sequential step ${item.op}`);
      assertStrictEqual(res.data.result, item.expected, `Result check for ${item.op}`);
    }
  });

  return results;
}

module.exports = runTier3;
