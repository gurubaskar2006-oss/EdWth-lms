import mongoose from 'mongoose';
import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: './server/.env' });
  dotenv.config();
}

let mongodInstance = null;

// Track connection listeners to prevent duplicate registrations on reconnect/reuse
let listenersAttached = false;

const attachConnectionListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('error', (err) => {
    console.error('❌ [MongoDB] Connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ [MongoDB] Disconnected from database.');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('🔄 [MongoDB] Reconnected to database.');
  });
};

/**
 * Connect to MongoDB database.
 * Uses MONGO_URI from environment.
 * 
 * Production mode (NODE_ENV=production):
 * - Strictly requires MONGO_URI.
 * - Fails fast if MONGO_URI is missing or unreachable.
 * - NEVER falls back to in-memory database in production.
 * 
 * Development / Test mode:
 * - Attempts to connect to MONGO_URI if provided.
 * - If no MONGO_URI or in isolated test mode, can use MongoMemoryServer.
 */
/**
 * Returns canonical production connection options.
 * Enforces autoIndex: false and autoCreate: false so that the restricted runtime
 * application user never attempts index or collection creation on startup.
 */
export const getProductionConnectionOptions = (customOptions = {}) => {
  const serverSelectionTimeoutMS = parseInt(process.env.MONGO_TIMEOUT_MS, 10) || 15000;
  return {
    autoIndex: false,
    autoCreate: false,
    maxPoolSize: 50,
    minPoolSize: 10,
    serverSelectionTimeoutMS,
    socketTimeoutMS: 45000,
    ...customOptions
  };
};

export const connectDB = async (customOptions = {}) => {
  // Connection reuse: If already connected, return existing connection
  if (mongoose.connection.readyState === 1) {
    return { conn: mongoose.connection, isInMemory: Boolean(mongodInstance) };
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const mongoURI = process.env.MONGO_URI;

  attachConnectionListeners();

  // 1. PRODUCTION MODE: Strict fail-fast requirements
  if (isProduction) {
    if (!mongoURI) {
      const errMsg = 'FATAL: MONGO_URI environment variable is not defined in production mode. Server cannot start.';
      console.error(`❌ [Database Startup] ${errMsg}`);
      throw new Error(errMsg);
    }

    try {
      console.log('📡 [MongoDB] Connecting to MongoDB Atlas cluster in production mode...');
      const connectionOptions = getProductionConnectionOptions(customOptions);
      const conn = await mongoose.connect(mongoURI, connectionOptions);
      console.log(`✅ [MongoDB] Production Atlas Connected: host=${conn.connection.host}, database=${conn.connection.name} [Pool: max 50, min 10, autoIndex: false]`);
      return { conn, isInMemory: false };
    } catch (error) {
      const errMsg = `FATAL: Failed to connect to MongoDB Atlas in production: ${error.message}`;
      console.error(`❌ [Database Startup] ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  // 2. STAGING / DEVELOPMENT / TEST MODE
  const isTest = process.env.NODE_ENV === 'test';
  const effectiveMongoURI = isTest ? process.env.TEST_MONGO_URI : mongoURI;

  if (effectiveMongoURI) {
    try {
      console.log('📡 [MongoDB] Connecting to configured database...');
      const conn = await mongoose.connect(effectiveMongoURI, {
        maxPoolSize: 50,
        minPoolSize: 10,
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        ...customOptions
      });
      console.log(`✅ [MongoDB Connected]: host=${conn.connection.host}, db=${conn.connection.name} (Durable storage)`);
      return { conn, isInMemory: false };
    } catch (error) {
      console.warn(`⚠️ [MongoDB] Configured MongoDB connection failed (${error.message}).`);
      if (process.env.REQUIRE_REMOTE_DB === 'true' || (process.env.ALLOW_IN_MEMORY_DB !== 'true' && !isTest)) {
        console.error('❌ [MongoDB] Database is unavailable. In-memory fallback is disabled (set ALLOW_IN_MEMORY_DB=true for local offline development).');
        throw error;
      }
      console.log('🔄 [MongoDB] ALLOW_IN_MEMORY_DB=true is active. Falling back to ephemeral In-Memory database for offline local testing...');
    }
  } else {
    console.log(isTest 
      ? '🧪 [MongoDB] Test environment active (NODE_ENV=test). Using isolated in-memory database to protect production.'
      : 'ℹ️ [MongoDB] No MONGO_URI configured in environment. Initializing local in-memory database for testing...');
  }

  // 3. Fallback to MongoMemoryServer (Test / Offline Local Development Only)
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongodInstance = await MongoMemoryServer.create({
      instance: { dbName: 'lumina_lms', launchTimeout: 120000 }
    });
    const uri = mongodInstance.getUri();
    const conn = await mongoose.connect(uri, {
      ...customOptions
    });
    console.log(`⚠️ [MongoDB] Ephemeral In-Memory Database Initialized (NOT durable across restarts): ${uri}`);
    return { conn, isInMemory: true, uri };
  } catch (memErr) {
    if (mongodInstance) {
      try {
        await mongodInstance.stop();
      } catch (stopErr) {
        console.warn('⚠️ [MongoDB] Warning while stopping temporary in-memory instance:', stopErr.message);
      }
      mongodInstance = null;
    }
    console.error(`❌ [MongoDB] In-memory database initialization failed: ${memErr.message}`);
    throw memErr;
  }
};

/**
 * Close database connection and stop any in-memory instance cleanly.
 */
export const closeDB = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('🛑 [MongoDB] Connection closed cleanly.');
    }
    if (mongodInstance) {
      await mongodInstance.stop();
      mongodInstance = null;
      console.log('🛑 [MongoDB] In-Memory server stopped.');
    }
  } catch (err) {
    console.error('Error closing database:', err.message);
  }
};
