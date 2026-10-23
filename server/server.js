import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Sentry from '@sentry/node';
import { connectDB, closeDB } from './database/mongoose.js';
import { initDatabase } from './database/db.js';
import { runSeed } from './scripts/seedData.js';
import { provisionDevTestAccounts } from './scripts/provisionDevTestAccount.js';
import { verifyToken, requireRole } from './middleware/authMiddleware.js';
import { validateProductionEnv } from './config/environment.js';

import User from './models/User.js';
import authRoutes from './routes/authRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import trainerRoutes from './routes/trainerRoutes.js';
import executeRoutes from './routes/executeRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import dataRoutes from './routes/dataRoutes.js';
import assessmentRoutes from './routes/assessmentRoutes.js';
import teacherNoteRoutes from './routes/teacherNoteRoutes.js';
import schoolRoutes from './routes/schoolRoutes.js';
import storageRoutes from './routes/storageRoutes.js';
import { adminSensitiveLimiter, uploadRateLimiter } from './middleware/rateLimitMiddleware.js';
import { validateBoundaryRequest } from './middleware/securityBoundary.js';

import { initRedis, closeRedis, isRedisHealthy } from './services/redisService.js';
import { isPistonHealthy } from './services/pistonService.js';
import { executionQueue } from './services/executionQueue.js';

import http from 'http';
import { Server } from 'socket.io';
import { setupSocketIO } from './socket/socketHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Early validation of production environment variables
try {
  validateProductionEnv();
} catch (envErr) {
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Trust front-facing reverse proxy (Hetzner Load Balancer / Nginx) for client IP and HTTPS protocol
app.set('trust proxy', 1);

if (process.env.SENTRY_DSN && process.env.SENTRY_DSN !== 'your_sentry_dsn' && process.env.SENTRY_DSN.startsWith('http')) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
  console.log('Sentry initialized for error tracking.');
}

// Connect to MongoDB
connectDB().then(async (dbInfo) => {
  const isInMemory = dbInfo?.isInMemory;
  if (isInMemory) {
    console.warn('\n================================================================');
    console.warn('⚠️  [DATABASE WARNING] RUNNING IN-MEMORY (mongodb-memory-server)');
    console.warn('⚠️  Academic and user data will NOT persist across server restarts.');
    console.warn('⚠️  For durable persistence, ensure local MongoDB service is running');
    console.warn('    or configure a valid MONGO_URI in server/.env.');
    console.warn('================================================================\n');
  } else {
    console.log(`✅ [MongoDB] Connected to durable database: ${mongoose.connection.host}/${mongoose.connection.name}`);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const userCount = await User.countDocuments();
  const withAcademicDemo = process.env.SEED_DEMO_ACADEMIC === 'true';
  const withDemoStudents = process.env.SEED_DEMO_STUDENTS === 'true';

  if (!isProduction && process.env.AUTO_SEED === 'true') {
    console.log(`Explicit auto-seed requested (Users: ${userCount}, demo students: ${withDemoStudents ? 'ENABLED' : 'DISABLED'}, demo academic records: ${withAcademicDemo ? 'ENABLED' : 'DISABLED'})...`);
    await runSeed({ withAcademicDemo, withDemoStudents, force: true }).catch(err => console.error('Foundational seed error:', err));
  } else if (!isProduction && process.env.PROVISION_DEV_TEST_ACCOUNTS === 'true' && userCount === 0) {
    console.log('ℹ️ [Dev Environment] Provisioning minimal dev test login accounts (0 demo students, 0 demo classes)...');
    await provisionDevTestAccounts().catch(err => console.error('Dev test account provisioning error:', err.message));
  } else if (isProduction) {
    if (userCount === 0) {
      console.warn('⚠️ [Production Safeguard] User database is empty. Automatic demo seeding is strictly prohibited in production.');
      console.warn('   Initial Company Super-Admin must be provisioned via the explicit operator script: node server/scripts/provisionSuperAdmin.js');
    } else {
      console.log(`✅ [MongoDB] Production database connected. Foundational records present (${userCount} users).`);
    }
  } else {
    console.log(`ℹ️ [Database Startup] Clean zero-demo runtime active (Users: ${userCount}). Automatic demo seeding is disabled.`);
  }
}).catch((fatalErr) => {
  console.error('❌ [FATAL] Database initialization failed:', fatalErr.message);
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.REQUIRE_REMOTE_DB === 'true'
  ) {
    process.exit(1);
  }
});

// Initialize legacy data sheet repository only if explicitly opted in
if (process.env.ENABLE_LEGACY_DATASHEET_FALLBACK === 'true') {
  initDatabase();
}

// Initialize Redis if configured
initRedis().catch(err => console.warn('Redis init notification:', err.message));

// Security Headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: false, // Allows Vite dev tooling and Monaco Editor web workers
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS Configuration
// Reads from ALLOWED_ORIGINS env var (comma-separated) and merges with base local list.
// This allows production domains to be configured without code changes.
const BASE_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

const ENV_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : [
      'http://portal.domain.com',
      'http://trainer.domain.com',
      'http://admin.domain.com'
    ];

const allowedOrigins = [...new Set([...BASE_ORIGINS, ...ENV_ORIGINS])];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Body size limits — configurable via env, never allow unbounded request bodies
const BODY_SIZE_LIMIT = process.env.BODY_SIZE_LIMIT || '10mb';
app.use(express.json({ limit: BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));
app.use(cookieParser());

// Boundary Request Sanitation & Security Validation Middleware
// Rejects malformed, ambiguous, or malicious URL paths at the boundary before router execution
app.use(validateBoundaryRequest);

// Structured request logging (non-sensitive: method, path, status, duration)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    // Never log Authorization headers, cookies, or request bodies
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[HTTP] ${level} ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Liveness Probe: Simple check if process is alive
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    service: 'Lumina LMS Enterprise API by 6th Civilians Corporation'
  });
});

// Readiness Probe: Verifies upstream dependencies (Database, Redis, Piston)
app.get('/api/v1/ready', async (req, res) => {
  const isDbReady = mongoose.connection.readyState === 1;
  const isRedisReady = await isRedisHealthy();
  const isPistonReady = await isPistonHealthy();
  const queueStats = executionQueue.getStats();

  const checks = {
    database: isDbReady ? 'connected' : 'disconnected',
    redis: isRedisReady ? 'connected' : (process.env.NODE_ENV === 'production' ? 'disconnected' : 'in-memory-fallback'),
    piston: isPistonReady ? 'available' : (process.env.NODE_ENV === 'production' ? 'unavailable' : 'dev-simulation'),
    executionQueue: queueStats
  };

  const isReady = isDbReady && (process.env.NODE_ENV === 'production' ? isRedisReady : true);

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not-ready',
    timestamp: new Date().toISOString(),
    checks
  });
});

// Mount API Routes
app.use('/api/v1/auth',     authRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/admin',    adminSensitiveLimiter, adminRoutes);
app.use('/api/v1/trainer',  trainerRoutes);
app.use('/api/v1/school',   schoolRoutes);
app.use('/api/v1/execute',  executeRoutes);
app.use('/api/v1/notes',    uploadRateLimiter, noteRoutes);
app.use('/api/v1/data',     dataRoutes);
app.use('/api/v1/assessments', assessmentRoutes);
app.use('/api/v1/teacher-notes', verifyToken, teacherNoteRoutes);
app.use('/api/v1/storage', storageRoutes);
// Mount audit router with strict RBAC at the mount level
app.use('/api/v1/audit', verifyToken, requireRole('admin', 'superadmin'), auditRoutes);

// Explicit 404 handler for unmatched API routes — always returns JSON, never falls through to SPA
app.all(['/api', '/api/*'], (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'API_ENDPOINT_NOT_FOUND',
      message: `API endpoint ${req.method} ${req.originalUrl || req.path} not found.`
    }
  });
});

// Frontend Static File Serving & Multi-Page Web App Routing
const DIST_PATH = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH, {
    maxAge: process.env.NODE_ENV === 'production' ? '1y' : 0,
    immutable: process.env.NODE_ENV === 'production',
    index: false
  }));

  app.get('/trainer', (req, res) => {
    res.sendFile(path.join(DIST_PATH, 'trainer.html'));
  });
  app.get('/trainer.html', (req, res) => {
    res.sendFile(path.join(DIST_PATH, 'trainer.html'));
  });

  app.get('/admin', (req, res) => {
    res.sendFile(path.join(DIST_PATH, 'admin.html'));
  });
  app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(DIST_PATH, 'admin.html'));
  });

  // Root & SPA fallback for student portal
  app.get('*', (req, res, next) => {
    const cleanPath = req.path ? req.path.replace(/\/+/g, '/') : '';
    if (cleanPath.startsWith('/api') || cleanPath.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
}

// Centralized error handler — never expose internal errors to clients
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (statusCode >= 500) {
    console.error('[Error]', err.message, err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code:    err.code    || 'INTERNAL_ERROR',
      message: isProduction && statusCode >= 500
        ? 'An unexpected error occurred. Please try again.'
        : (err.message || 'Internal server error')
    }
  });
});

// Socket.io initialization with CORS & WebSocket-only transport (Stateless horizontal multi-instance scaling)
const io = new Server(httpServer, {
  transports: ['websocket'],
  cors: {
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }
});

setupSocketIO(io);
app.set('io', io);

// Start Server on 0.0.0.0 (Accessible across all network devices)
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 Lumina LMS Enterprise Server running on port ${PORT}`);
    console.log(`🏠 Local URL: http://localhost:${PORT}`);
    console.log(`🔌 Real-Time Socket.io: Active (Horizontal Redis scaling enabled)`);
    console.log(`🛡️ Isolated Code Lab: Active (Piston Sandbox Queue)`);
    console.log(`====================================================`);
  });
}

// Graceful Shutdown Handler
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 [Shutdown] Received ${signal}. Starting graceful shutdown...`);

  httpServer.close(async () => {
    console.log('🛑 [HTTP] Server stopped accepting incoming requests.');

    try {
      io.close();
      console.log('🛑 [Socket.io] Sockets disconnected.');

      executionQueue.drain();
      console.log('🛑 [Queue] Execution queue drained.');

      await closeRedis();

      await closeDB();

      console.log('✅ [Shutdown] Graceful shutdown completed cleanly.');
      process.exit(0);
    } catch (err) {
      console.error('❌ [Shutdown] Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Force shutdown if cleanup hangs past 10s
  setTimeout(() => {
    console.error('⚠️ [Shutdown] Forced exit due to timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, httpServer, io };
export default app;
