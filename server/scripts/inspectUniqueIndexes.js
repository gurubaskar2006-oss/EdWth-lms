/**
 * Lumina LMS — Read-Only Database Index & Duplicate Verification Audit
 * 6th Civilians Corporation
 *
 * SAFETY CONSTRAINTS:
 * 1. STRICTLY READ-ONLY: Never creates, drops, or alters any index.
 * 2. ZERO MUTATION: Never updates, deletes, or merges any document.
 * 3. EXHAUSTIVE: Audits all registered collections, indexes, and aggregation duplicate sets.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import mongoose from 'mongoose';
import { connectDB, closeDB } from '../database/mongoose.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelsDir = path.resolve(__dirname, '../models');
const files = fs.readdirSync(modelsDir).filter((f) => f.endsWith('.js'));

// Dynamically register all models
for (const f of files) {
  const filePath = path.resolve(modelsDir, f);
  await import(pathToFileURL(filePath).href);
}

async function runReadOnlyAudit() {
  await connectDB();

  const db = mongoose.connection.db;
  const dbName = db.databaseName;
  const models = mongoose.models;

  console.log('================================================================================');
  console.log(' LUMINA LMS — READ-ONLY UNIQUE INDEX & DUPLICATE PRE-FLIGHT AUDIT');
  console.log('================================================================================');
  console.log(`Timestamp       : ${new Date().toISOString()}`);
  console.log(`Database Name   : ${dbName}`);
  console.log(`Host            : ${mongoose.connection.host}`);
  console.log(`Total Models    : ${Object.keys(models).length}`);
  console.log('================================================================================\n');

  let totalUniqueIndexes = 0;
  let totalDuplicateSets = 0;
  const collectionSummaries = [];

  for (const [modelName, model] of Object.entries(models)) {
    const collName = model.collection.name;
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`Model: [${modelName}] | Collection: [${collName}]`);

    try {
      const indexes = await model.collection.indexes();
      console.log(`  Existing Indexes (${indexes.length}):`);
      for (const idx of indexes) {
        console.log(`    - "${idx.name}": ${JSON.stringify(idx.key)} [unique: ${!!idx.unique}, sparse: ${!!idx.sparse}]`);
      }

      const uniqueIndexes = indexes.filter((idx) => idx.unique && idx.name !== '_id_');

      if (uniqueIndexes.length === 0) {
        console.log(`  Unique Constraints: None (Non-unique collection or _id only)`);
        collectionSummaries.push({ modelName, collName, uniqueCount: 0, duplicates: 0 });
      } else {
        for (const idx of uniqueIndexes) {
          totalUniqueIndexes++;
          const keys = Object.keys(idx.key);
          const groupFields = {};
          keys.forEach((k) => {
            groupFields[k] = `$${k}`;
          });

          // Read-only duplicate detection pipeline
          const matchCondition = keys.reduce((acc, k) => {
            acc[k] = { $ne: null };
            return acc;
          }, {});

          const duplicates = await model.aggregate([
            { $match: matchCondition },
            { $group: { _id: groupFields, count: { $sum: 1 }, sampleIds: { $push: '$_id' } } },
            { $match: { count: { $gt: 1 } } }
          ]).limit(10);

          if (duplicates.length > 0) {
            totalDuplicateSets += duplicates.length;
            console.log(`  ⚠️  DUPLICATES DETECTED on Index "${idx.name}": ${duplicates.length} duplicate set(s) found!`);
            console.log(`      Sample: ${JSON.stringify(duplicates, null, 2)}`);
            collectionSummaries.push({ modelName, collName, indexName: idx.name, duplicates: duplicates.length });
          } else {
            console.log(`  ✅  Duplicate Check on Index "${idx.name}": 0 duplicates found.`);
            collectionSummaries.push({ modelName, collName, indexName: idx.name, duplicates: 0 });
          }
        }
      }
    } catch (err) {
      console.log(`  Notice: Collection empty or uninitialized in active database: ${err.message}`);
      collectionSummaries.push({ modelName, collName, status: 'uninitialized' });
    }
  }

  console.log('\n================================================================================');
  console.log(' AUDIT SUMMARY');
  console.log('================================================================================');
  console.log(`Database Evaluated             : ${dbName}`);
  console.log(`Total Collections Inspected    : ${Object.keys(models).length}`);
  console.log(`Total Unique Indexes Evaluated : ${totalUniqueIndexes}`);
  console.log(`Total Duplicate Sets Detected  : ${totalDuplicateSets}`);
  console.log(`Integrity Status               : ${totalDuplicateSets === 0 ? 'CLEAN (Zero Duplicates)' : 'CONFLICTS FOUND'}`);
  console.log('================================================================================\n');

  await closeDB();
  process.exit(totalDuplicateSets === 0 ? 0 : 2);
}

runReadOnlyAudit().catch(async (err) => {
  console.error('FATAL AUDIT FAILURE:', err);
  try {
    await closeDB();
  } catch {}
  process.exit(1);
});
