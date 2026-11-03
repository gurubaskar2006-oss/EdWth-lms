/**
 * Lumina LMS — Safe Redis Diagnostics Script
 * 6th Civilians Corporation
 *
 * SAFETY RULES:
 * 1. Read-only diagnostic: Never writes, mutates, or flushes data.
 * 2. Strict Redaction: NEVER prints credentials, auth strings, or connection URLs.
 * 3. Inspects actual runtime client status, fallback adapters, and environment variable presence.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import {
  initRedis,
  isRedisHealthy,
  getRedisClient,
  closeRedis
} from '../services/redisService.js';
import { idempotencyStorage } from '../middleware/idempotencyMiddleware.js';
import { getEffectiveClient as getAttendanceStore } from '../services/attendanceSessionService.js';
import { getEffectiveClient as getAssessmentStore } from '../services/assessmentSessionService.js';

async function diagnose() {
  console.log('================================================================================');
  console.log(' LUMINA LMS — SAFE REDIS CONFIGURATION & RUNTIME DIAGNOSTIC');
  console.log('================================================================================');
  console.log(`Node Environment          : ${process.env.NODE_ENV || 'development'}`);
  console.log(`Timestamp                 : ${new Date().toISOString()}`);
  console.log('--------------------------------------------------------------------------------');
  console.log('ENVIRONMENT VARIABLE PRESENCE AUDIT (Values Redacted):');
  console.log(`  REDIS_URL configured?   : ${Boolean(process.env.REDIS_URL)}`);
  console.log(`  REDIS_HOST configured?  : ${Boolean(process.env.REDIS_HOST)}`);
  console.log(`  REDIS_PORT configured?  : ${Boolean(process.env.REDIS_PORT)}`);
  console.log(`  REDIS_PASSWORD set?     : ${Boolean(process.env.REDIS_PASSWORD)}`);
  console.log(`  REQUIRE_REDIS set?      : ${Boolean(process.env.REQUIRE_REDIS === 'true')}`);
  console.log('--------------------------------------------------------------------------------');
  console.log('RUNTIME CONNECTION ATTEMPT:');

  const client = await initRedis();
  const healthy = await isRedisHealthy();
  const activeClient = getRedisClient();

  console.log(`  Client Instantiated?    : ${Boolean(client)}`);
  console.log(`  Client Ready?           : ${Boolean(activeClient && activeClient.status === 'ready')}`);
  console.log(`  Status String           : ${client ? client.status : 'null'}`);
  console.log(`  Ping Health Check       : ${healthy ? 'PONG (Operational)' : 'FAILED (Offline / Unreachable)'}`);
  console.log('--------------------------------------------------------------------------------');
  console.log('ACTIVE ADAPTER & SUBSYSTEM AUDIT:');

  const idemStoreType = idempotencyStorage.getStoreType();
  console.log(`  Idempotency Middleware  : Protected by [${idemStoreType.toUpperCase()}] store`);

  const attStore = getAttendanceStore();
  const attStoreName = attStore ? (attStore.constructor?.name || 'Unknown') : 'None (Throws 503)';
  console.log(`  Attendance Sessions     : Using [${attStoreName}]`);

  const assessStore = getAssessmentStore();
  const assessStoreName = assessStore ? (assessStore.constructor?.name || 'Unknown') : 'None';
  console.log(`  Assessment Proctoring   : Using [${assessStoreName}]`);

  console.log(`  Socket.io Real-Time     : Using [${healthy ? 'RedisAdapter' : 'InMemoryAdapter'}]`);
  console.log('================================================================================\n');

  await closeRedis();
  process.exit(0);
}

diagnose().catch((err) => {
  console.error('Diagnostic error:', err.message);
  process.exit(1);
});

