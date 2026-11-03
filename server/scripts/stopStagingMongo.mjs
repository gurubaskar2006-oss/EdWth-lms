/**
 * Lumina LMS — Local Staging MongoDB Stopper
 * 6th Civilians Corporation
 *
 * Gracefully shuts down the local staging MongoDB daemon on 127.0.0.1:27018.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const EXPECTED_HOST = '127.0.0.1';
const EXPECTED_PORT = 27018;
const STAGING_DATA_DIR = path.resolve(rootDir, '.staging_mongo_data');
const PID_FILE = path.resolve(STAGING_DATA_DIR, 'mongod.pid');

async function main() {
  console.log('🛑 [Staging Stopper] Attempting graceful shutdown of local staging MongoDB...');
  try {
    const client = new MongoClient(`mongodb://${EXPECTED_HOST}:${EXPECTED_PORT}/?directConnection=true`, {
      serverSelectionTimeoutMS: 2000
    });
    await client.connect();
    console.log('   Connected to mongod. Sending shutdown command...');
    try {
      await client.db('admin').command({ shutdown: 1 });
    } catch (err) {
      // shutdown command typically closes the socket immediately, causing a network error
      console.log('   Shutdown command sent.');
    }
    await client.close();
  } catch (err) {
    console.log('   Could not connect via TCP socket:', err.message);
  }

  if (fs.existsSync(PID_FILE)) {
    const pid = fs.readFileSync(PID_FILE, 'utf8').trim();
    try {
      process.kill(Number(pid), 'SIGTERM');
      console.log(`   Sent SIGTERM to PID ${pid}.`);
    } catch {
      // process already dead
    }
    try {
      fs.unlinkSync(PID_FILE);
    } catch {}
  }
  console.log('✅ Local staging MongoDB stopped.');
}

main().catch(console.error);

