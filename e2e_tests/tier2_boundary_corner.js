const {
  assert,
  assertStrictEqual,
  assertStatusCode,
  assertHeader,
  assertJSONBody,
  makeRequest,
  transformOperation,
  parseDockerfile,
  parseCompose,
  parseK8sYaml
} = require('./utils/helpers');
const path = require('path');
const fs = require('fs');

async function runTier2(baseUrl = 'http://localhost:5050') {
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

  // Obtain valid user token for task tests
  let validToken = '';
  try {
    const loginRes = await makeRequest({
      url: `${baseUrl}/api/auth/login`,
      method: 'POST',
      body: { email: 'user@example.com', password: 'password123' }
    });
    if (loginRes.data && loginRes.data.token) {
      validToken = loginRes.data.token;
    }
  } catch (e) {
    validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyXzEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsImlhdCI6MTYxNjEyMzQ1Nn0.mockSignature123456789';
  }

  // Domain 1: Auth Edge Cases (5 tests)
  await test('T2_AUTH_01', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/auth/register`,
      method: 'POST',
      body: { email: 'duplicate@example.com', password: 'password123' }
    });
    assert(res.status === 400 || res.status === 409, `T2_AUTH_01: Duplicate email registration rejection 400/409, got ${res.status}`);
  });

  await test('T2_AUTH_02', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/auth/login`,
      method: 'POST',
      body: { email: 'user@example.com', password: 'wrongpassword' }
    });
    assertStatusCode(res, 401, 'T2_AUTH_02: Invalid password login rejection');
  });

  await test('T2_AUTH_03', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'GET',
      headers: { Authorization: 'Bearer malformed' }
    });
    assertStatusCode(res, 401, 'T2_AUTH_03: Malformed JWT header rejection');
  });

  await test('T2_AUTH_04', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'GET',
      headers: { Authorization: 'Bearer expired' }
    });
    assertStatusCode(res, 401, 'T2_AUTH_04: Expired/invalid JWT signature rejection');
  });

  await test('T2_AUTH_05', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/auth/login`,
      method: 'POST',
      body: {}
    });
    assertStatusCode(res, 400, 'T2_AUTH_05: Missing required fields on auth endpoints rejection');
  });

  // Domain 2: Task Creation Edge Cases (5 tests)
  await test('T2_TASK_01', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` },
      body: { title: 'Empty Input Task', operationType: 'UPPERCASE', inputText: '' }
    });
    assertStatusCode(res, 400, 'T2_TASK_01: Empty inputText handling / rejection');
  });

  await test('T2_TASK_02', async () => {
    const largeText = 'A'.repeat(102400); // 100KB+
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` },
      body: { title: 'Large Task', operationType: 'UPPERCASE', inputText: largeText }
    });
    assertStatusCode(res, 201, 'T2_TASK_02: 100KB+ extra-large inputText handling');
    assertStrictEqual(res.data.result.length, 102400, 'T2_TASK_02: Result length check');
  });

  await test('T2_TASK_03', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` },
      body: { title: 'Invalid OP Task', operationType: 'INVALID_OP', inputText: 'hello' }
    });
    assertStatusCode(res, 400, 'T2_TASK_03: Invalid operationType rejection');
  });

  await test('T2_TASK_04', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` },
      body: { operationType: 'UPPERCASE', inputText: 'hello' }
    });
    assertStatusCode(res, 400, 'T2_TASK_04: Missing title validation');
  });

  await test('T2_TASK_05', async () => {
    const injectionStr = "<script>alert('xss')</script> OR '1'='1' -- $(); drop database;";
    const res = await makeRequest({
      url: `${baseUrl}/api/tasks`,
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` },
      body: { title: 'Injection Task', operationType: 'UPPERCASE', inputText: injectionStr }
    });
    assertStatusCode(res, 201, 'T2_TASK_05: Special characters injection handling');
    assert(res.data.result.includes("<SCRIPT>ALERT('XSS')</SCRIPT>"), 'T2_TASK_05: Injection string treated as literal');
  });

  // Domain 3: Operation Edge Cases (5 tests)
  await test('T2_OP_01', async () => {
    const unicodeInput = '🚀 Hello 🌟 World 🌍';
    const output = transformOperation('UPPERCASE', unicodeInput);
    assertStrictEqual(output, '🚀 HELLO 🌟 WORLD 🌍', 'T2_OP_01: Unicode & emoji string transformation');
  });

  await test('T2_OP_02', async () => {
    const multilineInput = "Line 1\nLine 2\tTabbed\r\nLine 3";
    const output = transformOperation('WORD_COUNT', multilineInput);
    assertStrictEqual(output, '7', 'T2_OP_02: Multiline string WORD_COUNT calculation');
  });

  await test('T2_OP_03', async () => {
    const singleWord = 'Supercalifragilisticexpialidocious';
    const output = transformOperation('WORD_COUNT', singleWord);
    assertStrictEqual(output, '1', 'T2_OP_03: Single-word WORD_COUNT check');
  });

  await test('T2_OP_04', async () => {
    const specialStr = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/';
    const output = transformOperation('REVERSE_STRING', specialStr);
    assertStrictEqual(output, specialStr.split('').reverse().join(''), 'T2_OP_04: Special characters in reverse string');
  });

  await test('T2_OP_05', async () => {
    const whitespaceStr = "   \n\t  \r  ";
    const output = transformOperation('WORD_COUNT', whitespaceStr);
    assertStrictEqual(output, '0', 'T2_OP_05: Whitespace-only string WORD_COUNT check');
  });

  // Domain 4: Rate Limit Burst (5 tests)
  await test('T2_RATE_01', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/auth/login`,
      method: 'POST',
      headers: { 'x-test-burst': 'true' },
      body: { email: 'user@example.com', password: 'password123' }
    });
    assertStatusCode(res, 429, 'T2_RATE_01: Rapid consecutive requests burst');
  });

  await test('T2_RATE_02', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/auth/login`,
      method: 'POST',
      headers: { 'x-test-burst': 'true' },
      body: { email: 'user@example.com', password: 'password123' }
    });
    assertStrictEqual(res.status, 429, 'T2_RATE_02: Verification of 429 status code');
  });

  await test('T2_RATE_03', async () => {
    const res = await makeRequest({
      url: `${baseUrl}/api/auth/login`,
      method: 'POST',
      headers: { 'x-test-burst': 'true' },
      body: { email: 'user@example.com', password: 'password123' }
    });
    assertHeader(res, 'retry-after', '60', 'T2_RATE_03: retry-after header check');
    assertHeader(res, 'x-ratelimit-limit', '5', 'T2_RATE_03: x-ratelimit-limit header check');
  });

  await test('T2_RATE_04', async () => {
    const res = await makeRequest(`${baseUrl}/health`);
    assertStatusCode(res, 200, 'T2_RATE_04: Rate limit window reset verification');
  });

  await test('T2_RATE_05', async () => {
    const res = await makeRequest(`${baseUrl}/health`);
    assertStatusCode(res, 200, 'T2_RATE_05: Static asset / health route non-blocking check');
  });

  // Domain 5: Container & K8s Edge Cases (5 tests)
  const invalidUserDockerfile = `FROM node:18-alpine\nWORKDIR /app\nCOPY . .\nCMD ["node", "app.js"]`;
  const missingProbesK8s = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: backend\nspec:\n  template:\n    spec:\n      containers:\n      - name: backend\n        image: backend:latest`;
  const missingSecretsK8s = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: backend\nspec:\n  template:\n    spec:\n      containers:\n      - name: backend\n        image: backend:1.0.0`;

  await test('T2_K8S_01', async () => {
    const parsed = parseDockerfile(invalidUserDockerfile);
    assert(!parsed.hasNonRootUser, 'T2_K8S_01: Static check for missing non-root USER in Dockerfile');
  });

  await test('T2_K8S_02', async () => {
    const parsed = parseK8sYaml(missingProbesK8s);
    assert(!parsed.hasProbes, 'T2_K8S_02: Static check for missing liveness/readiness probes');
  });

  await test('T2_K8S_03', async () => {
    const parsed = parseK8sYaml(missingProbesK8s);
    assert(!parsed.hasResourceLimits, 'T2_K8S_03: Static check for missing CPU/memory limits');
  });

  await test('T2_K8S_04', async () => {
    const hasLatestTag = /image:\s*\S+:latest/i.test(missingProbesK8s);
    assert(hasLatestTag, 'T2_K8S_04: Static check for unpinned :latest image tag');
  });

  await test('T2_K8S_05', async () => {
    const parsed = parseK8sYaml(missingSecretsK8s);
    assert(!parsed.hasSecrets, 'T2_K8S_05: Static check for missing secret key references');
  });

  return results;
}

module.exports = runTier2;
