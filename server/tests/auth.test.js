import request from 'supertest';
import app from '../server.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

describe('Auth Security (A2)', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'production';
    delete process.env.MONGO_URI;
  });

  afterAll(() => {
    process.env.NODE_ENV = 'test';
    mongoose.disconnect();
  });

  it('should throw an error and prevent login if mock mode is attempted in production', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'admin@nexus.edu', password: 'password' });

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Cannot run in mock mode in production');
  });

  it('should return 401 when hitting a protected route with no token or an expired token', async () => {
    // 1. No token
    const resNoToken = await request(app).get('/api/v1/audit');
    expect(resNoToken.statusCode).toBe(401);
    expect(resNoToken.body.message).toContain('no token');

    // 2. Expired token
    const testSecret = process.env.JWT_SECRET || 'test_secret_32_characters_minimum_lumina';
    const expiredToken = jwt.sign({ id: '12345' }, testSecret, { expiresIn: '0s' });
    const resExpired = await request(app)
      .get('/api/v1/audit')
      .set('Cookie', [`jwt=${expiredToken}`]);
    expect(resExpired.statusCode).toBe(401);
    expect(resExpired.body.message).toContain('token failed');
  });
});
