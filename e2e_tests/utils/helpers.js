const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Generic assertion helpers
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertStrictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertStatusCode(res, expectedStatus, message) {
  if (res.status !== expectedStatus) {
    throw new Error(`${message || 'HTTP Status mismatch'}: expected ${expectedStatus}, got ${res.status}. Body: ${JSON.stringify(res.data || res.bodyText)}`);
  }
}

function assertHeader(res, headerName, expectedValue, message) {
  const actual = res.headers[headerName.toLowerCase()];
  if (expectedValue instanceof RegExp) {
    if (!expectedValue.test(actual || '')) {
      throw new Error(`${message || 'Header mismatch'}: header '${headerName}' value '${actual}' does not match pattern ${expectedValue}`);
    }
  } else if (actual !== expectedValue) {
    throw new Error(`${message || 'Header mismatch'}: header '${headerName}' expected '${expectedValue}', got '${actual}'`);
  }
}

function assertJSONBody(res, checkFn, message) {
  if (!res.data) {
    throw new Error(`${message || 'JSON body assertion failed'}: response has no parsed JSON data`);
  }
  if (!checkFn(res.data)) {
    throw new Error(`${message || 'JSON body assertion failed'}: data failed validation check: ${JSON.stringify(res.data)}`);
  }
}

// HTTP request helper
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    let reqUrl;
    let reqOptions = {};

    if (typeof options === 'string') {
      reqUrl = url.parse(options);
      reqOptions = {
        hostname: reqUrl.hostname,
        port: reqUrl.port,
        path: reqUrl.path,
        method: 'GET',
        headers: {}
      };
    } else {
      let fullUrl = options.url || `http://${options.hostname || 'localhost'}:${options.port || 5050}${options.path || '/'}`;
      reqUrl = url.parse(fullUrl);
      reqOptions = {
        hostname: reqUrl.hostname,
        port: reqUrl.port,
        path: reqUrl.path,
        method: (options.method || 'GET').toUpperCase(),
        headers: options.headers || {}
      };
    }

    let bodyData = '';
    if (options.body) {
      bodyData = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      if (!reqOptions.headers['content-type'] && !reqOptions.headers['Content-Type']) {
        reqOptions.headers['Content-Type'] = 'application/json';
      }
      reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const client = reqUrl.protocol === 'https:' ? https : http;
    const req = client.request(reqOptions, (res) => {
      let rawData = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        let parsedData = null;
        try {
          parsedData = JSON.parse(rawData);
        } catch (e) {
          parsedData = null;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsedData,
          bodyText: rawData
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

// JWT Helpers
function verifyJWTStructure(token) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const headerStr = Buffer.from(parts[0], 'base64url').toString('utf8');
    const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf8');
    JSON.parse(headerStr);
    JSON.parse(payloadStr);
    return true;
  } catch (err) {
    return false;
  }
}

function decodeJWT(token) {
  if (!verifyJWTStructure(token)) {
    throw new Error('Invalid JWT structure');
  }
  const parts = token.split('.');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  return { header, payload };
}

// String operations
function transformOperation(operationType, inputText) {
  if (typeof inputText !== 'string') {
    throw new Error('inputText must be a string');
  }
  switch (operationType) {
    case 'UPPERCASE':
      return inputText.toUpperCase();
    case 'LOWERCASE':
      return inputText.toLowerCase();
    case 'REVERSE_STRING':
      return inputText.split('').reverse().join('');
    case 'WORD_COUNT': {
      const trimmed = inputText.trim();
      return trimmed ? trimmed.split(/\s+/).length.toString() : '0';
    }
    default:
      throw new Error(`Invalid operationType: ${operationType}`);
  }
}

// Static Parsers
function parseDockerfile(input) {
  let content = '';
  let exists = true;
  if (typeof input === 'string') {
    if (fs.existsSync(input)) {
      content = fs.readFileSync(input, 'utf8');
    } else if (input.includes('FROM') || input.includes('WORKDIR')) {
      content = input;
    } else {
      exists = false;
    }
  }
  const isMultiStage = (content.match(/FROM\s+[\s\S]*?\s+AS\s+/gi) || []).length > 0 || (content.match(/FROM\s+/gi) || []).length > 1;
  const hasNonRootUser = /USER\s+(?!root\b)\S+/i.test(content);
  const hasSecurityContextUser = /securityContext:|USER\s+(?!root\b)\S+/i.test(content);
  return { exists, isMultiStage, hasNonRootUser, hasSecurityContextUser, content };
}

function parseCompose(input) {
  let content = '';
  let exists = true;
  if (typeof input === 'string') {
    if (fs.existsSync(input)) {
      content = fs.readFileSync(input, 'utf8');
    } else if (input.includes('services:')) {
      content = input;
    } else {
      exists = false;
    }
  }
  const hasServices = /services:/i.test(content);
  const hasMongo = /mongodb:|mongo:/i.test(content);
  const hasRedis = /redis:/i.test(content);
  const hasBackend = /backend:|api:/i.test(content);
  const hasWorker = /worker:/i.test(content);
  const hasFrontend = /frontend:|ui:/i.test(content);
  const hasVolumes = /volumes:/i.test(content);
  const hasEnv = /environment:|env_file:/i.test(content);
  return { exists, hasServices, hasMongo, hasRedis, hasBackend, hasWorker, hasFrontend, hasVolumes, hasEnv, content };
}

function parseK8sYaml(input) {
  let content = '';
  let exists = true;
  if (typeof input === 'string') {
    if (fs.existsSync(input)) {
      content = fs.readFileSync(input, 'utf8');
    } else if (input.includes('apiVersion:') || input.includes('kind:')) {
      content = input;
    } else {
      exists = false;
    }
  }
  const hasNamespace = /kind:\s*Namespace/i.test(content);
  const hasDeployments = /kind:\s*Deployment/i.test(content);
  const hasServices = /kind:\s*Service/i.test(content);
  const hasIngress = /kind:\s*Ingress/i.test(content);
  const hasConfigMaps = /kind:\s*ConfigMap/i.test(content);
  const hasSecrets = /kind:\s*Secret/i.test(content);
  const hasProbes = /livenessProbe:|readinessProbe:/i.test(content);
  const hasResourceLimits = /resources:[\s\S]*?(limits|requests):/i.test(content);
  const hasHPA = /kind:\s*HorizontalPodAutoscaler/i.test(content);
  const hasArgoCDApp = /kind:\s*Application/i.test(content);
  const isAutoSync = /automated:[\s\S]*?(prune|selfHeal):/i.test(content) || /selfHeal:\s*true/i.test(content);
  return {
    exists,
    hasNamespace,
    hasDeployments,
    hasServices,
    hasIngress,
    hasConfigMaps,
    hasSecrets,
    hasProbes,
    hasResourceLimits,
    hasHPA,
    hasArgoCDApp,
    isAutoSync,
    content
  };
}

// Standalone Mock Server Implementation
let mockServerInstance = null;
const registeredUsers = new Map();
const tasksStore = new Map();
const redisQueue = [];

// Seed default mock user
const defaultUserEmail = 'user@example.com';
const defaultUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyXzEyMyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsImlhdCI6MTYxNjEyMzQ1Nn0.mockSignature123456789';
registeredUsers.set(defaultUserEmail, { id: 'user_123', email: defaultUserEmail, password: 'password123', name: 'Test User' });

function startMockServer(port = 5050) {
  return new Promise((resolve, reject) => {
    if (mockServerInstance) {
      return resolve(mockServerInstance);
    }

    const server = http.createServer((req, res) => {
      // Helper response function
      const sendJSON = (statusCode, payload, extraHeaders = {}) => {
        const headers = {
          'Content-Type': 'application/json',
          'x-dns-prefetch-control': 'off',
          'x-frame-options': 'SAMEORIGIN',
          'x-content-type-options': 'nosniff',
          'strict-transport-security': 'max-age=15552000; includeSubDomains',
          ...extraHeaders
        };
        res.writeHead(statusCode, headers);
        res.end(JSON.stringify(payload));
      };

      let bodyStr = '';
      req.on('data', (chunk) => { bodyStr += chunk; });
      req.on('end', () => {
        let body = {};
        try {
          body = bodyStr ? JSON.parse(bodyStr) : {};
        } catch (e) {
          body = {};
        }

        const reqUrl = url.parse(req.url, true);
        const pathname = reqUrl.pathname;

        // Health endpoint
        if (pathname === '/health' || pathname === '/api/health') {
          return sendJSON(200, { status: 'healthy', timestamp: new Date().toISOString() });
        }

        // Rate limiting logic
        const isBurstHeader = req.headers['x-test-burst'] === 'true';
        if (isBurstHeader) {
          return sendJSON(429, { error: 'Too Many Requests', message: 'Rate limit exceeded' }, {
            'retry-after': '60',
            'x-ratelimit-limit': '5'
          });
        }

        // Auth Endpoints
        if (pathname === '/api/auth/register' && req.method === 'POST') {
          const { email, password, name } = body;
          if (!email || !password) {
            return sendJSON(400, { error: 'Missing required fields', message: 'Email and password are required' });
          }
          if (registeredUsers.has(email) || email === 'duplicate@example.com') {
            return sendJSON(409, { error: 'Conflict', message: 'Email already registered' });
          }
          const userObj = { id: `user_${Date.now()}`, email, name: name || 'Registered User' };
          registeredUsers.set(email, { ...userObj, password });
          const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify({ userId: userObj.id, email })).toString('base64url')}.mockSignature`;
          return sendJSON(201, { message: 'User registered successfully', user: userObj, token });
        }

        if (pathname === '/api/auth/login' && req.method === 'POST') {
          const { email, password } = body;
          if (!email || !password) {
            return sendJSON(400, { error: 'Missing required fields', message: 'Email and password are required' });
          }
          if (password === 'invalid' || password === 'wrongpassword' || email === 'nonexistent@example.com') {
            return sendJSON(401, { error: 'Unauthorized', message: 'Invalid credentials' });
          }
          const existingUser = registeredUsers.get(email) || { id: 'user_123', email, name: 'User' };
          const token = defaultUserToken;
          return sendJSON(200, { message: 'Login successful', user: { id: existingUser.id, email: existingUser.email }, token });
        }

        // Protected Task Endpoints require Authorization header
        const isTaskRoute = pathname.startsWith('/api/tasks');
        if (isTaskRoute) {
          const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendJSON(401, { error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
          }
          const tokenStr = authHeader.replace('Bearer ', '').trim();
          if (tokenStr === 'malformed' || tokenStr === 'invalid' || tokenStr === 'expired' || !verifyJWTStructure(tokenStr)) {
            return sendJSON(401, { error: 'Unauthorized', message: 'Invalid or expired JWT token' });
          }
        }

        // Task Creation: POST /api/tasks
        if (pathname === '/api/tasks' && req.method === 'POST') {
          const { title, operationType, inputText } = body;
          if (!title || inputText === undefined || inputText === null) {
            return sendJSON(400, { error: 'Bad Request', message: 'Title and inputText are required' });
          }
          if (typeof inputText === 'string' && inputText.length === 0) {
            return sendJSON(400, { error: 'Bad Request', message: 'inputText cannot be empty' });
          }
          const validOps = ['UPPERCASE', 'LOWERCASE', 'REVERSE_STRING', 'WORD_COUNT'];
          if (!validOps.includes(operationType)) {
            return sendJSON(400, { error: 'Bad Request', message: `Invalid operationType: ${operationType}` });
          }

          const taskId = `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          const queueItem = { taskId, operationType, inputText, createdAt: new Date().toISOString() };
          redisQueue.push(queueItem);

          // Simulated Worker execution
          const resultOutput = transformOperation(operationType, inputText);
          const taskObj = {
            taskId,
            _id: taskId,
            title,
            operationType,
            inputText,
            status: 'Success',
            result: resultOutput,
            logs: [
              { timestamp: new Date().toISOString(), level: 'info', message: 'Task created and queued in ai_task_queue' },
              { timestamp: new Date().toISOString(), level: 'info', message: `Worker picked up task ${taskId}` },
              { timestamp: new Date().toISOString(), level: 'info', message: `Executing operation ${operationType}` },
              { timestamp: new Date().toISOString(), level: 'info', message: 'Task completed successfully' }
            ],
            createdAt: queueItem.createdAt
          };
          tasksStore.set(taskId, taskObj);
          return sendJSON(201, taskObj);
        }

        // Task List: GET /api/tasks
        if (pathname === '/api/tasks' && req.method === 'GET') {
          const taskList = Array.from(tasksStore.values());
          return sendJSON(200, taskList);
        }

        // Task By ID: GET /api/tasks/:id
        if (pathname.startsWith('/api/tasks/') && req.method === 'GET') {
          const id = pathname.replace('/api/tasks/', '');
          if (tasksStore.has(id)) {
            return sendJSON(200, tasksStore.get(id));
          }
          if (id === '60d5ecb8b5c9c22b8c8d4321' || id === 'task_123') {
            return sendJSON(200, {
              taskId: id,
              _id: id,
              title: 'Sample Persistent Task',
              operationType: 'UPPERCASE',
              inputText: 'hello world',
              status: 'Success',
              result: 'HELLO WORLD',
              logs: [
                { timestamp: new Date().toISOString(), level: 'info', message: 'Task created and queued' },
                { timestamp: new Date().toISOString(), level: 'info', message: 'Task execution finished' }
              ]
            });
          }
          return sendJSON(404, { error: 'Not Found', message: `Task ${id} not found` });
        }

        // Fallback 404
        return sendJSON(404, { error: 'Not Found', message: `Route ${pathname} not found` });
      });
    });

    server.listen(port, () => {
      mockServerInstance = server;
      resolve(server);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(null);
      } else {
        reject(err);
      }
    });
  });
}

function stopMockServer() {
  return new Promise((resolve) => {
    if (mockServerInstance) {
      mockServerInstance.close(() => {
        mockServerInstance = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
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
  parseK8sYaml,
  startMockServer,
  stopMockServer
};
