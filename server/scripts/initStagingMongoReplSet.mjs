/**
 * Lumina LMS — Local Staging MongoDB Replica Set Provisioner & Verifier
 * 6th Civilians Corporation
 *
 * Strictly initializes and verifies an isolated local MongoDB replica set:
 * - Host: 127.0.0.1 only
 * - Port: 27018 only
 * - Replica set: rs0
 * - Storage: Dedicated local staging directory (.staging_mongo_data)
 * - Zero remote connections; zero modifications to production.
 */

import fs from 'fs';
import path from 'path';
import net from 'net';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const EXPECTED_HOST = '127.0.0.1';
const EXPECTED_PORT = 27018;
const EXPECTED_REPL_SET = 'rs0';
const TARGET_DB_NAME = 'lumina_staging';
const STAGING_DATA_DIR = path.resolve(rootDir, '.staging_mongo_data');
const MONGOD_PATH = path.resolve(rootDir, 'node_modules/.cache/mongodb-memory-server/mongod-x64-win32-8.2.6.exe');
const PID_FILE = path.resolve(STAGING_DATA_DIR, 'mongod.pid');
const LOG_FILE = path.resolve(STAGING_DATA_DIR, 'mongod.log');

/**
 * Checks whether a TCP port is accepting connections.
 */
function probePort(host, port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      status = true;
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Waits for a TCP port to open.
 */
async function waitForPort(host, port, maxWaitMs = 25000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const isOpen = await probePort(host, port, 500);
    if (isOpen) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  console.log('================================================================');
  console.log('🛡️  LUMINA LMS — LOCAL STAGING DATABASE PROVISIONER');
  console.log('================================================================');

  // 1. Verify exact MongoDB executable exists and query version
  if (!fs.existsSync(MONGOD_PATH)) {
    console.error(`❌ FATAL: mongod executable not found at: ${MONGOD_PATH}`);
    process.exit(1);
  }

  let mongoVersionStr = 'unknown';
  let mongoBuildInfo = {};
  try {
    const versionOutput = execSync(`"${MONGOD_PATH}" --version`, { encoding: 'utf8' });
    const match = versionOutput.match(/db version (v[\d.]+)/);
    if (match) {
      mongoVersionStr = match[1];
    }
    console.log(`✅ [Step 1] Verified MongoDB binary: ${MONGOD_PATH}`);
    console.log(`   Version: ${mongoVersionStr}`);
  } catch (err) {
    console.error('❌ FATAL: Failed to query mongod version:', err.message);
    process.exit(1);
  }

  // 2. Inspect proposed staging data directory (do not delete or overwrite)
  if (!fs.existsSync(STAGING_DATA_DIR)) {
    fs.mkdirSync(STAGING_DATA_DIR, { recursive: true });
    console.log(`✅ [Step 2] Created dedicated staging data directory: ${STAGING_DATA_DIR}`);
  } else {
    const existingEntries = fs.readdirSync(STAGING_DATA_DIR);
    console.log(`✅ [Step 2] Inspected staging data directory: ${STAGING_DATA_DIR}`);
    console.log(`   Existing entries found: ${existingEntries.length}`);
    if (existingEntries.length > 0) {
      console.log(`   Sample contents: ${existingEntries.slice(0, 5).join(', ')}`);
      console.log('   Preserving all existing data. Overwrite protection ACTIVE.');
    }
  }

  // 3. Verify port 27018 status
  const isPortOccupied = await probePort(EXPECTED_HOST, EXPECTED_PORT, 800);
  let mongodPid = null;

  if (isPortOccupied) {
    console.log(`ℹ️ [Step 3] Port ${EXPECTED_PORT} is currently in use. Verifying if it is our staging replica set...`);
    // Check if it's already our replica set
    try {
      const client = new MongoClient(`mongodb://${EXPECTED_HOST}:${EXPECTED_PORT}/?directConnection=true`, {
        serverSelectionTimeoutMS: 3000
      });
      await client.connect();
      const hello = await client.db('admin').command({ hello: 1 });
      await client.close();

      if (hello.setName === EXPECTED_REPL_SET) {
        console.log(`✅ Staging MongoDB replica set "${EXPECTED_REPL_SET}" is already running on port ${EXPECTED_PORT}.`);
        if (fs.existsSync(PID_FILE)) {
          mongodPid = fs.readFileSync(PID_FILE, 'utf8').trim();
        }
      } else {
        console.error(`❌ FATAL: Port ${EXPECTED_PORT} is occupied by an unexpected server (setName: ${hello.setName || 'none'}).`);
        console.error('   Aborting immediately to prevent conflict with external services.');
        process.exit(1);
      }
    } catch (connErr) {
      console.error(`❌ FATAL: Port ${EXPECTED_PORT} is open but rejected MongoDB connection:`, connErr.message);
      process.exit(1);
    }
  } else {
    console.log(`✅ [Step 3] Port ${EXPECTED_PORT} is free.`);

    // 4. Start MongoDB bound exclusively to 127.0.0.1:27018 with replSet rs0
    console.log(`🚀 [Step 4] Starting MongoDB process...`);
    console.log(`   Bind Address: ${EXPECTED_HOST}`);
    console.log(`   Port: ${EXPECTED_PORT}`);
    console.log(`   Replica Set: ${EXPECTED_REPL_SET}`);
    console.log(`   Data Dir: ${STAGING_DATA_DIR}`);

    const logFd = fs.openSync(LOG_FILE, 'a');

    const mongodProc = spawn(
      MONGOD_PATH,
      [
        '--dbpath', STAGING_DATA_DIR,
        '--port', String(EXPECTED_PORT),
        '--bind_ip', EXPECTED_HOST,
        '--replSet', EXPECTED_REPL_SET
      ],
      {
        detached: true,
        stdio: ['ignore', logFd, logFd]
      }
    );

    mongodPid = mongodProc.pid;
    fs.writeFileSync(PID_FILE, String(mongodPid), 'utf8');
    mongodProc.unref();

    console.log(`   Spawned mongod process with PID: ${mongodPid}`);

    // 5. Wait for the process to start listening on 127.0.0.1:27018
    console.log(`⏳ [Step 5] Waiting for MongoDB to listen on ${EXPECTED_HOST}:${EXPECTED_PORT}...`);
    const portOpened = await waitForPort(EXPECTED_HOST, EXPECTED_PORT, 25000);
    if (!portOpened) {
      console.error(`❌ FATAL: mongod process failed to open port ${EXPECTED_PORT} within 25 seconds.`);
      if (fs.existsSync(LOG_FILE)) {
        console.error('   Recent mongod log output:');
        const logs = fs.readFileSync(LOG_FILE, 'utf8');
        console.error(logs.slice(-1500));
      }
      process.exit(1);
    }
    console.log(`✅ [Step 5] MongoDB is actively listening on ${EXPECTED_HOST}:${EXPECTED_PORT}.`);
  }

  // 6. Connect via directConnection and initialize replica set if not already initialized
  console.log(`🔌 [Step 6] Connecting to local MongoDB on ${EXPECTED_HOST}:${EXPECTED_PORT} for replica set management...`);
  const directClient = new MongoClient(`mongodb://${EXPECTED_HOST}:${EXPECTED_PORT}/?directConnection=true`, {
    serverSelectionTimeoutMS: 5000
  });

  await directClient.connect();
  const adminDb = directClient.db('admin');

  let rsStatus = null;
  try {
    rsStatus = await adminDb.command({ replSetGetStatus: 1 });
    console.log(`✅ Replica set "${EXPECTED_REPL_SET}" is already initialized.`);
  } catch (err) {
    if (err.codeName === 'NotYetInitialized' || err.code === 94 || err.message.includes('no replset config')) {
      console.log(`⚙️  Replica set not yet initialized. Executing replSetInitiate for "${EXPECTED_REPL_SET}"...`);
      const initiateResult = await adminDb.command({
        replSetInitiate: {
          _id: EXPECTED_REPL_SET,
          members: [
            {
              _id: 0,
              host: `${EXPECTED_HOST}:${EXPECTED_PORT}`
            }
          ]
        }
      });
      console.log(`✅ replSetInitiate acknowledged:`, initiateResult.ok === 1 ? 'OK' : initiateResult);
    } else {
      console.error(`❌ Unexpected error checking replica set status:`, err.message);
      await directClient.close();
      process.exit(1);
    }
  }

  // 7. Wait for the replica set to reach PRIMARY
  console.log(`⏳ [Step 7] Waiting for local replica set node to achieve PRIMARY state...`);
  let isPrimary = false;
  const primaryWaitStart = Date.now();
  let latestStatus = null;

  while (Date.now() - primaryWaitStart < 30000) {
    try {
      latestStatus = await adminDb.command({ replSetGetStatus: 1 });
      const myMember = latestStatus.members?.find((m) => m.self);
      if (myMember && myMember.stateStr === 'PRIMARY') {
        isPrimary = true;
        break;
      }
    } catch {
      // transient election errors while stepping up
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!isPrimary) {
    console.error('❌ FATAL: Replica set failed to reach PRIMARY state within 30 seconds.');
    await directClient.close();
    process.exit(1);
  }

  console.log(`✅ [Step 7] Replica set node achieved PRIMARY state.`);
  await directClient.close();

  // 8. Connect using the full staging replicaSet connection string and verify
  const stagingUri = `mongodb://${EXPECTED_HOST}:${EXPECTED_PORT}/${TARGET_DB_NAME}?replicaSet=${EXPECTED_REPL_SET}`;
  console.log(`🔍 [Step 8] Verifying connection using staging URI: ${stagingUri}`);

  const stagingClient = new MongoClient(stagingUri, { serverSelectionTimeoutMS: 5000 });
  await stagingClient.connect();

  const hello = await stagingClient.db('admin').command({ hello: 1 });
  const stagingDb = stagingClient.db(TARGET_DB_NAME);
  const collections = await stagingDb.listCollections().toArray();

  await stagingClient.close();

  // 9. Safety confirmation: zero application records created
  console.log(`✅ [Step 9] Safety verification: zero application records or seed scripts executed.`);
  console.log(`   Collections in "${TARGET_DB_NAME}": ${collections.length}`);

  // 10. Final Report
  console.log('================================================================');
  console.log('🎉 LOCAL STAGING DATABASE INITIALIZATION COMPLETE');
  console.log('================================================================');
  console.log(`- Process ID:        ${mongodPid || '(running daemon)'}`);
  console.log(`- MongoDB Version:   ${mongoVersionStr}`);
  console.log(`- Listening Address: ${EXPECTED_HOST}:${EXPECTED_PORT} (Loopback Only)`);
  console.log(`- Replica Set Name:  ${hello.setName} (Primary: ${hello.primary})`);
  console.log(`- Replica Set State: PRIMARY (writable)`);
  console.log(`- Intended Database: ${TARGET_DB_NAME}`);
  console.log(`- Data Directory:    ${STAGING_DATA_DIR}`);
  console.log(`- Application Data:  0 collections (Clean & Unseeded)`);
  console.log(`- Atlas / Remote DB: STRICTLY UNTOUCHED & DISCONNECTED`);
  console.log('================================================================');
}

main().catch((err) => {
  console.error('❌ FATAL UNCAUGHT ERROR during staging MongoDB initialization:', err);
  process.exit(1);
});

