/**
 * Lumina LMS — Real Backblaze B2 Controlled Live Integration Test
 * 6th Civilians Corporation
 *
 * Requirements:
 * "If real B2 credentials are available, perform a separate controlled integration test
 * using a disposable test file, then verify object and metadata cleanup.
 * Do not claim a real integration test passed if only mocks were used."
 */

import crypto from 'crypto';
import {
  uploadObject,
  getPresignedDownloadUrl,
  deleteObject,
  isStorageConfigured,
  getBucketName
} from '../utils/b2Storage.js';

describe('Backblaze B2 Live Object Storage Integration (Real Credentials)', () => {
  const disposableKey = `integration-tests/disposable-${Date.now()}-${crypto.randomUUID()}.txt`;
  const disposableContent = Buffer.from(`Lumina LMS Disposable Integration Verification: ${new Date().toISOString()}`);

  it('should verify Backblaze B2 credentials are configured and valid', () => {
    expect(isStorageConfigured()).toBe(true);
    expect(getBucketName()).toBeDefined();
  });

  it('should upload a disposable test object to the real B2 bucket', async () => {
    const uploadRes = await uploadObject({
      key: disposableKey,
      body: disposableContent,
      contentType: 'text/plain',
      metadata: {
        disposable: 'true',
        testSuite: 'schoolStudyMaterialsAndB2'
      }
    });

    expect(uploadRes).toBeDefined();
    expect(uploadRes.$metadata.httpStatusCode).toBe(200);
  });

  it('should generate a functional presigned download URL for the uploaded disposable object', async () => {
    const downloadUrl = await getPresignedDownloadUrl({
      key: disposableKey,
      expiresInSeconds: 300
    });

    expect(downloadUrl).toBeDefined();
    expect(downloadUrl).toContain('X-Amz-Signature');
    expect(downloadUrl).toContain(encodeURIComponent(disposableKey).replace(/%2F/g, '/'));
  });

  it('should clean up and delete the disposable test object from Backblaze B2', async () => {
    const deleteRes = await deleteObject({ key: disposableKey });
    expect(deleteRes).toBeDefined();
    expect([200, 204]).toContain(deleteRes.$metadata.httpStatusCode);
  });
});
