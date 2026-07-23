const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('ioredis', () => require('ioredis-mock'));

const app = require('../src/app');
const User = require('../src/models/User');

let mongoServer;

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
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('Auth API Routes', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully and return 201 with token and user object', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.name).toBe('Test User');
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('should reject registration if email is already registered (return 400)', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Existing User',
          email: 'test@example.com',
          password: 'password123'
        });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'New User',
          email: 'test@example.com',
          password: 'password456'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'incomplete@example.com'
        });

      expect(res.statusCode).toEqual(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Login User',
          email: 'login@example.com',
          password: 'secretpassword'
        });
    });

    it('should login successfully with valid credentials and return token and user object (200)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'secretpassword'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe('login@example.com');
      expect(res.body.user.name).toBe('Login User');
    });

    it('should fail login with incorrect password (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword'
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toMatch(/invalid credentials/i);
    });

    it('should fail login with non-existent email (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'secretpassword'
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toMatch(/invalid credentials/i);
    });
  });

  describe('GET /api/auth/me', () => {
    let token;
    let userId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Me User',
          email: 'me@example.com',
          password: 'password123'
        });

      token = res.body.token;
      userId = res.body.user.id;
    });

    it('should return the current user profile when valid token provided (200)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.user.id).toBe(userId);
      expect(res.body.user.email).toBe('me@example.com');
      expect(res.body.user.name).toBe('Me User');
    });

    it('should return 401 if token is missing', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.statusCode).toEqual(401);
    });

    it('should return 401 if token is invalid', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken123');

      expect(res.statusCode).toEqual(401);
    });
  });
});
