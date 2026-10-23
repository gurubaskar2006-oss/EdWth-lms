/**
 * Lumina LMS — Database Connection & Fail-Safe Test Suite
 * 6th Civilians Corporation
 *
 * Verifies:
 * 1. NODE_ENV=production + missing MONGO_URI fails fast with clear error
 * 2. NODE_ENV=production + invalid MONGO_URI fails fast without in-memory fallback
 * 3. Non-production / test mode safely provides in-memory isolated DB when MONGO_URI is omitted
 * 4. Graceful connection close
 */

import { connectDB, closeDB } from '../database/mongoose.js';
import mongoose from 'mongoose';

describe('Database Connection Architecture & Fail-Safe Guards', () => {
  const originalEnv = { ...process.env };

  afterEach(async () => {
    await closeDB();
    process.env = { ...originalEnv };
  });

  afterAll(async () => {
    await closeDB();
    process.env = { ...originalEnv };
  });

  it('should fail fast in production if MONGO_URI is missing', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MONGO_URI;

    await expect(connectDB()).rejects.toThrow(/FATAL.*MONGO_URI.*not defined in production/i);
    expect(mongoose.connection.readyState).toBe(0);
  });

  it('should fail fast in production if MONGO_URI is unreachable without falling back to in-memory', async () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGO_TIMEOUT_MS = '1000';
    process.env.MONGO_URI = 'mongodb://127.0.0.1:27999/non_existent_unreachable_db';

    await expect(connectDB()).rejects.toThrow(/FATAL.*Failed to connect to MongoDB Atlas in production/i);
    expect(mongoose.connection.readyState).toBe(0);
  }, 10000);

  it('should allow isolated in-memory DB in test environment when MONGO_URI is omitted', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.MONGO_URI;

    const res = await connectDB();
    expect(res).toBeDefined();
    expect(res.isInMemory).toBe(true);
    expect(mongoose.connection.readyState).toBe(1);
    await closeDB();
  }, 35000);
});
