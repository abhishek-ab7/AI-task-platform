const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('ioredis', () => require('ioredis-mock'));

const app = require('../src/app');
const User = require('../src/models/User');
const Task = require('../src/models/Task');
const redis = require('../src/config/redis');

let mongoServer;
let user1Token;
let user1Id;
let user2Token;
let user2Id;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '7.0.3',
      os: { os: 'linux', dist: 'ubuntu2204' }
    }
  });
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
  if (redis && typeof redis.quit === 'function') {
    await redis.quit();
  }
});

beforeEach(async () => {
  await User.deleteMany({});
  await Task.deleteMany({});
  if (redis && typeof redis.flushall === 'function') {
    await redis.flushall();
  }

  // Create User 1
  const u1Res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'User One',
      email: 'user1@example.com',
      password: 'password123'
    });
  user1Token = u1Res.body.token;
  user1Id = u1Res.body.user.id;

  // Create User 2
  const u2Res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'User Two',
      email: 'user2@example.com',
      password: 'password123'
    });
  user2Token = u2Res.body.token;
  user2Id = u2Res.body.user.id;
});

describe('Task API Routes', () => {
  describe('POST /api/tasks', () => {
    it('should create a task with Pending status and push to redis ai_task_queue (201)', async () => {
      const taskData = {
        title: 'Convert string to uppercase',
        inputText: 'hello world',
        operationType: 'UPPERCASE'
      };

      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(taskData);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('_id');
      expect(res.body.title).toBe(taskData.title);
      expect(res.body.inputText).toBe(taskData.inputText);
      expect(res.body.operationType).toBe(taskData.operationType);
      expect(res.body.status).toBe('Pending');
      expect(res.body.userId.toString()).toBe(user1Id.toString());

      // Verify Redis queue push
      const queueLength = await redis.llen('ai_task_queue');
      expect(queueLength).toBe(1);

      const pushedItemStr = await redis.lpop('ai_task_queue');
      const pushedItem = JSON.parse(pushedItemStr);
      expect(pushedItem.taskId).toBe(res.body._id);
      expect(pushedItem.operationType).toBe('UPPERCASE');
      expect(pushedItem.inputText).toBe('hello world');
    });

    it('should reject task creation with invalid operationType (400)', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Invalid Task',
          inputText: 'some text',
          operationType: 'INVALID_OP'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/invalid operationType/i);
    });

    it('should reject task creation with missing title (400)', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          inputText: 'some text',
          operationType: 'UPPERCASE'
        });

      expect(res.statusCode).toEqual(400);
    });

    it('should return 401 if unauthorized (no token)', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({
          title: 'No token task',
          inputText: 'text',
          operationType: 'UPPERCASE'
        });

      expect(res.statusCode).toEqual(401);
    });
  });

  describe('GET /api/tasks', () => {
    it('should fetch tasks belonging to logged-in user sorted by createdAt desc (200)', async () => {
      await Task.create({
        userId: user1Id,
        title: 'Task 1',
        inputText: 'input 1',
        operationType: 'LOWERCASE',
        createdAt: new Date(Date.now() - 10000)
      });

      await Task.create({
        userId: user1Id,
        title: 'Task 2',
        inputText: 'input 2',
        operationType: 'REVERSE_STRING',
        createdAt: new Date()
      });

      // Task for User 2 (should not appear in User 1's list)
      await Task.create({
        userId: user2Id,
        title: 'User 2 Task',
        inputText: 'input u2',
        operationType: 'WORD_COUNT'
      });

      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      expect(res.body[0].title).toBe('Task 2');
      expect(res.body[1].title).toBe('Task 1');
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('should fetch task by ID for authorized user (200)', async () => {
      const task = await Task.create({
        userId: user1Id,
        title: 'Fetch Me',
        inputText: 'hello',
        operationType: 'WORD_COUNT'
      });

      const res = await request(app)
        .get(`/api/tasks/${task._id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body._id).toBe(task._id.toString());
      expect(res.body.title).toBe('Fetch Me');
    });

    it('should return 404 when fetching another user task (User Isolation)', async () => {
      const taskUser2 = await Task.create({
        userId: user2Id,
        title: 'User 2 Private Task',
        inputText: 'private',
        operationType: 'UPPERCASE'
      });

      const res = await request(app)
        .get(`/api/tasks/${taskUser2._id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('should return 404 for non-existent task ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/tasks/${fakeId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toEqual(404);
    });
  });
});
