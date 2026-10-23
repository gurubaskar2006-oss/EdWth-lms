import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';

let pubClient = null;
let subClient = null;
let isConnected = false;
let connectionAttempted = false;

const getRedisConfig = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    retryStrategy: (times) => {
      if (times > 3) {
        return null; // Stop retrying quickly in dev
      }
      return Math.min(times * 300, 1000);
    }
  };
};

/**
 * Initialize primary Redis and subscriber clients
 */
export const initRedis = async () => {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  if (connectionAttempted) return pubClient;
  connectionAttempted = true;

  try {
    const config = getRedisConfig();
    pubClient = new Redis(config);
    subClient = pubClient.duplicate();

    pubClient.on('connect', () => {
      isConnected = true;
      console.log('✅ [Redis] Connected to Redis instance');
    });

    pubClient.on('ready', () => {
      isConnected = true;
      console.log('🚀 [Redis] Client ready for Pub/Sub and caching');
    });

    pubClient.on('error', (err) => {
      isConnected = false;
      // In development or test, log a clean warning without throwing unhandled exceptions
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`⚠️ [Redis] Connection notice (${err.code || err.message}). Operating with local in-memory fallback.`);
      } else {
        console.error('❌ [Redis] Production connection error:', err.message);
      }
    });

    subClient.on('error', (err) => {
      if (process.env.NODE_ENV !== 'production') {
        // Suppress redundant subscriber error in dev
      } else {
        console.error('❌ [Redis Sub] Subscriber error:', err.message);
      }
    });

    // Attempt non-blocking connection
    await Promise.race([
      pubClient.connect().catch((err) => {
        isConnected = false;
      }),
      new Promise((resolve) => setTimeout(resolve, 2000))
    ]);

    if (isConnected) {
      await subClient.connect().catch(() => {});
    }
  } catch (error) {
    isConnected = false;
    console.warn(`⚠️ [Redis] Initialization fallback: ${error.message}`);
  }

  return pubClient;
};

/**
 * Creates Socket.io Redis adapter if Redis is operational
 */
export const createSocketIORedisAdapter = async () => {
  await initRedis();
  if (isConnected && pubClient && subClient) {
    try {
      console.log('🔌 [Socket.io] Attaching Redis adapter for horizontal multi-node scaling');
      return createAdapter(pubClient, subClient);
    } catch (err) {
      console.warn('⚠️ [Socket.io] Failed to create Redis adapter, using memory adapter:', err.message);
      return null;
    }
  }
  return null;
};

/**
 * Check health status for /api/v1/ready probe
 */
export const isRedisHealthy = async () => {
  if (!pubClient || !isConnected) return false;
  try {
    const res = await pubClient.ping();
    return res === 'PONG';
  } catch (err) {
    return false;
  }
};

/**
 * Clean disconnect for graceful shutdown
 */
export const closeRedis = async () => {
  try {
    if (pubClient) await pubClient.quit();
    if (subClient) await subClient.quit();
    isConnected = false;
    console.log('🛑 [Redis] Connections closed cleanly');
  } catch (err) {
    console.warn('⚠️ [Redis] Error during shutdown:', err.message);
  }
};

export const getRedisClient = () => (isConnected && pubClient?.status === 'ready' ? pubClient : null);
export const getRedisSubscriber = () => (isConnected && subClient?.status === 'ready' ? subClient : null);

export default {
  initRedis,
  createSocketIORedisAdapter,
  isRedisHealthy,
  closeRedis,
  getRedisClient,
  getRedisSubscriber
};
