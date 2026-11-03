/**
 * Lumina LMS — Isolated Staging Backend Launcher
 * 6th Civilians Corporation
 *
 * Enforces strict staging isolation:
 * 1. Loads server/.env.staging exclusively.
 * 2. Validates required environment values before loading application modules.
 * 3. Refuses to run if NODE_ENV is not staging or if PORT is not 5001.
 * 4. Refuses to connect if the database host is not localhost on port 27018.
 * 5. Exits cleanly with non-zero exit code (1) before importing application modules on any violation.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { validateStagingEnvironmentConfig } from '../utils/stagingUriValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const stagingEnvPath = path.resolve(rootDir, 'server/.env.staging');

// 1. Staging configuration file existence check
if (!fs.existsSync(stagingEnvPath)) {
  console.error(`❌ [Staging Launcher] FATAL: Staging environment file not found at: ${stagingEnvPath}`);
  process.exit(1);
}

// 2. Explicitly load staging environment exclusively with override (no fallback to root .env)
const result = dotenv.config({ path: stagingEnvPath, override: true });
if (result.error) {
  console.error('❌ [Staging Launcher] Failed to parse staging environment file:', result.error.message);
  process.exit(1);
}

process.env.ENV_FILE = stagingEnvPath;

// 3. Strict fail-closed environment validation before any application modules are imported
const envValidation = validateStagingEnvironmentConfig(process.env, {
  expectedPort: 27018,
  expectedAppPort: '5001'
});

if (!envValidation.valid) {
  console.error('❌ [Staging Launcher] FATAL SAFETY VIOLATION: Staging configuration rejected.');
  console.error(`   Reason: ${envValidation.reason}`);
  console.error('   Connection to MongoDB Atlas, remote hosts, or incorrect ports is strictly prohibited in staging.');
  process.exit(1);
}

console.log('🛡️ [Staging Launcher] Staging environment verified.');
console.log(`   Environment: ${envValidation.env}`);
console.log(`   Target App Port: ${envValidation.port}`);
console.log(`   Target DB Hosts: ${envValidation.hosts.join(', ')}`);
console.log(`   Target DB Name: ${envValidation.database || '(default)'}`);
console.log('   Production Atlas: BLOCKED & UNREACHABLE');

// 4. Launch the Server after all safety gates have passed
await import('../server.js');
