# Lumina LMS

A comprehensive Learning Management System built with React, Vite, Node.js, and MongoDB.

## Environment Variables

For local development and production, the following environment variables are required. See `server/.env.example` for details.

### Security
- `JWT_SECRET`: Secret key for signing JWTs.
- `COOKIE_DOMAIN`: (Production only) The domain to set cookies on (e.g., `.yourcompany.com`) to allow cross-subdomain API requests.

### Database
- `MONGO_URI`: MongoDB connection string. If missing in production, the server will crash.

### Storage
- `R2_ENDPOINT`: Cloudflare R2 endpoint URL.
- `R2_ACCESS_KEY_ID`: Cloudflare R2 access key.
- `R2_SECRET_ACCESS_KEY`: Cloudflare R2 secret key.
- `R2_BUCKET_NAME`: Cloudflare R2 bucket name for file uploads.

### Monitoring
- `SENTRY_DSN`: Sentry DSN for error monitoring and crash reporting.

## Operations

### MongoDB Backup Restoration
Lumina LMS uses MongoDB Atlas. To restore an automated backup:
1. Log in to the [MongoDB Atlas Dashboard](https://cloud.mongodb.com).
2. Navigate to **Clusters** -> your active cluster -> **Backup** tab.
3. Select a snapshot from the list and click **Restore**.
4. Choose whether to restore to the original cluster or a new temporary cluster.
5. Wait for the restore process to complete. No application downtime is required if restoring to a temporary cluster to extract specific lost records.

### A10 Cross-Subdomain Verification
**IMPORTANT**: Before onboarding real colleges in a production environment, ensure that you have deployed the application to staging subdomains (e.g., `portal.staging.com`, `trainer.staging.com`, `admin.staging.com`, and `api.staging.com`). 
Manually verify that cookies are properly issued and persisted across subdomains using the `COOKIE_DOMAIN` environment variable and `SameSite=None; Secure` settings.
