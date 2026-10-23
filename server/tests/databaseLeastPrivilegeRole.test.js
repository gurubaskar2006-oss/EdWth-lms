/**
 * Lumina LMS — Database-Level Least-Privilege Role Acceptance Test Suite
 * 6th Civilians Corporation
 *
 * Verifies that the proposed MongoDB least-privilege role enforces security
 * AT THE DATABASE PERMISSION LAYER, independent of application/Mongoose hooks:
 * 1. Read and write (find, insert, update, remove) on all 17 mutable collections.
 * 2. Append-only enforcement on auditlogs: find and insert succeed; update and remove
 *    are rejected directly by MongoDB with MongoServerError (not authorized).
 * 3. Deployer separation: index creation requires a deployment role and is rejected
 *    for the runtime application user.
 * 4. Automatic index creation disabled (autoIndex: false) startup simulation.
 */

import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  LUMINA_APP_ROLE_NAME,
  MUTABLE_COLLECTIONS,
  getLuminaAppRoleDefinition
} from '../config/databaseRoles.js';

describe('Lumina LMS — Database-Level Least-Privilege Role Verification', () => {
  let mongod;
  let appConn;
  const dbName = 'lumina_privilege_acceptance';

  const mutableCollections = MUTABLE_COLLECTIONS;

  beforeAll(async () => {
    // 1. Launch isolated in-memory MongoDB instance with authentication enabled natively
    mongod = await MongoMemoryServer.create({
      auth: {
        enable: true,
        customRootName: 'siteAdmin',
        customRootPwd: 'SiteAdminPassword123!'
      }
    });
    const baseUri = mongod.getUri();

    // 2. Connect with root administrator credentials
    const authedAdminUri = baseUri.replace('mongodb://', 'mongodb://siteAdmin:SiteAdminPassword123!@') + '?authSource=admin';
    const adminClient = new MongoClient(authedAdminUri);
    await adminClient.connect();
    const adminTargetDb = adminClient.db(dbName);

    // 3. Create the canonical least-privilege role on target database
    const roleDefinition = getLuminaAppRoleDefinition(dbName);

    await adminTargetDb.command({
      createRole: roleDefinition.role,
      privileges: roleDefinition.privileges,
      roles: roleDefinition.roles
    });

    // 4. Create the application runtime service user with luminaAppServiceRole
    await adminTargetDb.command({
      createUser: 'luminaAppServiceUser',
      pwd: 'AppUserSecret123!',
      roles: [{ role: LUMINA_APP_ROLE_NAME, db: dbName }]
    });
    await adminClient.close();

    // 5. Connect as the runtime application service user
    const authedAppUri = baseUri.replace('mongodb://', 'mongodb://luminaAppServiceUser:AppUserSecret123!@') + `${dbName}?authSource=${dbName}`;
    appConn = await mongoose.createConnection(authedAppUri, { autoIndex: false }).asPromise();
  }, 60000);

  afterAll(async () => {
    if (appConn) await appConn.close();
    if (mongod) await mongod.stop();
  });

  it('verifies all 17 mutable collections support CRUD operations at the database layer', async () => {
    const db = appConn.db;

    for (const collectionName of mutableCollections) {
      const col = db.collection(collectionName);

      // Insert
      const insertResult = await col.insertOne({
        testId: `crud-${collectionName}`,
        status: 'active'
      });
      expect(insertResult.acknowledged).toBe(true);

      // Find
      const doc = await col.findOne({ _id: insertResult.insertedId });
      expect(doc).not.toBeNull();
      expect(doc.testId).toBe(`crud-${collectionName}`);

      // Update
      const updateResult = await col.updateOne(
        { _id: insertResult.insertedId },
        { $set: { status: 'updated' } }
      );
      expect(updateResult.modifiedCount).toBe(1);

      // Remove
      const deleteResult = await col.deleteOne({ _id: insertResult.insertedId });
      expect(deleteResult.deletedCount).toBe(1);
    }
  });

  it('allows insert and find on auditlogs at the database permission layer', async () => {
    const db = appConn.db;
    const auditCol = db.collection('auditlogs');

    // 1. Insert permitted
    const insertResult = await auditCol.insertOne({
      action: 'DB_LEAST_PRIVILEGE_TEST',
      actor: 'system',
      timestamp: new Date()
    });
    expect(insertResult.acknowledged).toBe(true);

    // 2. Find permitted
    const doc = await auditCol.findOne({ _id: insertResult.insertedId });
    expect(doc).not.toBeNull();
    expect(doc.action).toBe('DB_LEAST_PRIVILEGE_TEST');
  });

  it('strictly rejects update operations on auditlogs at the database permission layer', async () => {
    const db = appConn.db;
    const auditCol = db.collection('auditlogs');

    // First insert a test audit record
    const insertResult = await auditCol.insertOne({
      action: 'TAMPER_TEST',
      actor: 'system'
    });

    // Attempt direct database-level update (bypassing any Mongoose hooks)
    let updateError = null;
    try {
      await auditCol.updateOne(
        { _id: insertResult.insertedId },
        { $set: { action: 'TAMPERED_ACTION' } }
      );
    } catch (err) {
      updateError = err;
    }

    expect(updateError).not.toBeNull();
    // Must be rejected by MongoDB engine itself: code 13 (Unauthorized)
    expect(updateError.code).toBe(13);
    expect(updateError.message).toMatch(/not authorized on.*to execute command.*update.*auditlogs/i);

    // Verify document in database was NOT altered
    const unmutated = await auditCol.findOne({ _id: insertResult.insertedId });
    expect(unmutated.action).toBe('TAMPER_TEST');
  });

  it('strictly rejects delete operations on auditlogs at the database permission layer', async () => {
    const db = appConn.db;
    const auditCol = db.collection('auditlogs');

    const insertResult = await auditCol.insertOne({
      action: 'DELETE_TEST',
      actor: 'system'
    });

    // Attempt direct database-level delete (bypassing any Mongoose hooks)
    let deleteError = null;
    try {
      await auditCol.deleteOne({ _id: insertResult.insertedId });
    } catch (err) {
      deleteError = err;
    }

    expect(deleteError).not.toBeNull();
    // Must be rejected by MongoDB engine itself: code 13 (Unauthorized)
    expect(deleteError.code).toBe(13);
    expect(deleteError.message).toMatch(/not authorized on.*to execute command.*delete.*auditlogs/i);

    // Verify document in database still exists
    const stillExists = await auditCol.findOne({ _id: insertResult.insertedId });
    expect(stillExists).not.toBeNull();
  });

  it('strictly rejects index creation by runtime application user (deployer role separation)', async () => {
    const db = appConn.db;
    let createIndexError = null;

    try {
      await db.collection('users').createIndex({ email: 1 });
    } catch (err) {
      createIndexError = err;
    }

    expect(createIndexError).not.toBeNull();
    expect(createIndexError.code).toBe(13);
    expect(createIndexError.message).toMatch(/not authorized on.*to execute command.*createIndexes/i);
  });
});
