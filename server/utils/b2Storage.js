/**
 * Lumina LMS - Backblaze B2 Object Storage Service
 * 6th Civilians Corporation
 *
 * Dedicated S3-compatible object storage service for note attachments,
 * syllabus documents, exported CSV records, and lecture materials.
 *
 * Architecture Role: Object Storage.
 * Edge routing and TLS termination are managed separately by Hetzner Load Balancer.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: './server/.env' });
  dotenv.config();
}

const endpoint = process.env.B2_ENDPOINT || process.env.R2_ENDPOINT || process.env.S3_ENDPOINT;
const accessKeyId = process.env.B2_APPLICATION_KEY_ID || process.env.B2_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.B2_APPLICATION_KEY || process.env.R2_SECRET_ACCESS_KEY;
const region = process.env.B2_REGION || process.env.S3_REGION || 'us-west-004';
const bucketName = process.env.B2_BUCKET_NAME || process.env.R2_BUCKET_NAME || 'lumina-storage';

export const s3Client = new S3Client({
  region,
  endpoint: endpoint || undefined,
  credentials: (!endpoint || !accessKeyId || !secretAccessKey || String(accessKeyId).toLowerCase().includes('placeholder')) ? undefined : {
    accessKeyId,
    secretAccessKey
  },
  forcePathStyle: true // Recommended for B2 and local S3 simulations
});

export const b2StorageService = {
  isStorageConfigured: () => {
    if (!endpoint || !accessKeyId || !secretAccessKey) return false;
    if (String(accessKeyId).toLowerCase().includes('placeholder') || String(secretAccessKey).toLowerCase().includes('placeholder')) {
      return false;
    }
    return true;
  },

  getBucketName: () => bucketName,

  /**
   * Upload an object buffer to B2 Object Storage
   */
  uploadObject: async ({ key, body, contentType, metadata = {} }) => {
    if (!b2StorageService.isStorageConfigured()) {
      throw new Error('Object storage credentials not configured. Please set B2_ENDPOINT, B2_APPLICATION_KEY_ID, and B2_APPLICATION_KEY.');
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata
    });

    return await s3Client.send(command);
  },

  /**
   * Generate a secure, time-limited presigned download URL
   */
  getPresignedDownloadUrl: async ({ key, expiresInSeconds = 3600 }) => {
    if (!b2StorageService.isStorageConfigured()) {
      throw new Error('Object storage credentials not configured.');
    }

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    });

    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  },

  /**
   * Delete an object from B2 Object Storage
   */
  deleteObject: async ({ key }) => {
    if (!b2StorageService.isStorageConfigured()) {
      throw new Error('Object storage credentials not configured.');
    }

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key
    });

    return await s3Client.send(command);
  }
};

export const isStorageConfigured = (...args) => b2StorageService.isStorageConfigured(...args);
export const getBucketName = (...args) => b2StorageService.getBucketName(...args);
export const uploadObject = (...args) => b2StorageService.uploadObject(...args);
export const getPresignedDownloadUrl = (...args) => b2StorageService.getPresignedDownloadUrl(...args);
export const deleteObject = (...args) => b2StorageService.deleteObject(...args);

export default b2StorageService;
