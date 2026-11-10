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
import mongoose from 'mongoose';

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
  isB2Configured: () => {
    if (!endpoint || !accessKeyId || !secretAccessKey) return false;
    if (String(accessKeyId).toLowerCase().includes('placeholder') || String(secretAccessKey).toLowerCase().includes('placeholder')) {
      return false;
    }
    return true;
  },

  isStorageConfigured: () => {
    // Storage is available if Backblaze B2 is configured OR MongoDB is connected (GridFS durable fallback)
    if (b2StorageService.isB2Configured()) return true;
    return Boolean(mongoose.connection && mongoose.connection.readyState === 1);
  },

  getBucketName: () => bucketName,

  /**
   * Upload an object buffer to B2 Object Storage or MongoDB GridFS
   */
  uploadObject: async ({ key, body, contentType, metadata = {} }) => {
    if (b2StorageService.isB2Configured()) {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata
      });
      return await s3Client.send(command);
    }

    // Seamless MongoDB GridFS fallback when cloud object storage keys are unconfigured
    if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db) {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'study_materials' });
      return new Promise((resolve, reject) => {
        const uploadStream = bucket.openUploadStream(key, {
          contentType,
          metadata: {
            ...metadata,
            s3Key: key,
            contentType,
            uploadedAt: new Date()
          }
        });
        uploadStream.on('finish', () => resolve({ s3Key: key, gridFsId: uploadStream.id }));
        uploadStream.on('error', reject);
        uploadStream.end(body);
      });
    }

    throw new Error('Object storage service unavailable.');
  },

  /**
   * Generate a secure, time-limited presigned download URL
   */
  getPresignedDownloadUrl: async ({ key, expiresInSeconds = 3600 }) => {
    if (b2StorageService.isB2Configured()) {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key
      });
      return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
    }

    return null; // Return null so noteRoutes / storageRoutes can stream from GridFS directly
  },

  /**
   * Stream object directly from MongoDB GridFS
   */
  getDownloadStream: ({ key }) => {
    if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db) {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'study_materials' });
      return bucket.openDownloadStreamByName(key);
    }
    return null;
  },

  /**
   * Delete an object from B2 Object Storage or MongoDB GridFS
   */
  deleteObject: async ({ key }) => {
    if (b2StorageService.isB2Configured()) {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key
      });
      return await s3Client.send(command);
    }

    if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db) {
      try {
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'study_materials' });
        const files = await bucket.find({ filename: key }).toArray();
        for (const file of files) {
          await bucket.delete(file._id).catch(() => {});
        }
      } catch {}
      return { success: true };
    }
  }
};

export const isB2Configured = (...args) => b2StorageService.isB2Configured(...args);
export const isStorageConfigured = (...args) => b2StorageService.isStorageConfigured(...args);
export const getBucketName = (...args) => b2StorageService.getBucketName(...args);
export const uploadObject = (...args) => b2StorageService.uploadObject(...args);
export const getPresignedDownloadUrl = (...args) => b2StorageService.getPresignedDownloadUrl(...args);
export const getDownloadStream = (...args) => b2StorageService.getDownloadStream(...args);
export const deleteObject = (...args) => b2StorageService.deleteObject(...args);

export default b2StorageService;
