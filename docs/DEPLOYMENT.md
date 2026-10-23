# Lumina LMS V2 — Production Deployment Guide
**Platform Owner:** 6th Civilians Corporation

---

## 1. Prerequisites & Infrastructure Setup

1. **Hetzner Cloud Account:**
   - 2x or more Cloud Servers (e.g. CX31 or CPX31: 4 vCPU, 8 GB RAM) running Ubuntu 22.04 LTS / Debian 12.
   - 1x Managed **Hetzner Load Balancer** (LB11 or LB21) with public IPv4/IPv6.
2. **Managed MongoDB Atlas Cluster:**
   - M10+ replica set with IP access list configured to Hetzner server IPs.
3. **Redis 7 Instance:**
   - Managed Redis or standalone Redis server on the private Hetzner Cloud network.
4. **Backblaze B2 Account:**
   - S3-compatible private bucket created with application key & secret.

---

## 2. Secrets Management & Environment Setup

Do **NOT** commit `.env.production` containing real secrets to version control. Use `.env.example` as a template.

### 2.1 Secret Injection via Environment Variables
Set the following secrets in your production environment (via Doppler, Hetzner Cloud user-data, or Docker secrets):

```bash
# Critical Production Secrets
export NODE_ENV=production
export PORT=5000
export JWT_SECRET="<generate-64-char-hex-secret>"
export MONGO_URI="mongodb+srv://<user>:<pwd>@<cluster>.mongodb.net/lumina_production?retryWrites=true&w=majority"
export REDIS_HOST="10.0.0.5" # Private Hetzner network IP
export REDIS_PORT=6379
export REDIS_PASSWORD="<strong-redis-password>"

# Isolated Piston Execution Service Endpoints
export PISTON_WORKERS="http://10.0.0.10:2000,http://10.0.0.11:2000"

# Backblaze B2 S3-Compatible Storage
export B2_ENDPOINT="https://s3.us-west-004.backblazeb2.com"
export B2_APPLICATION_KEY_ID="<your-b2-key-id>"
export B2_APPLICATION_KEY="<your-b2-app-key>"
export B2_BUCKET_NAME="lumina-enterprise-production"
export B2_REGION="us-west-004"
```

---

## 3. Hetzner Load Balancer Configuration

1. **Create Load Balancer:**
   - Location: Same datacenter region as API servers (e.g., Falkenstein `fsn1` or Nuremberg `nbg1`).
   - Type: LB11.
2. **Configure Targets:**
   - Add API Server 1 (Port 5000).
   - Add API Server 2 (Port 5000).
3. **Add Services:**
   - **Port 443 (HTTPS):**
     - Protocol: HTTPS -> HTTP (Port 5000 on targets).
     - Certificate: Upload custom certificate or attach Let’s Encrypt managed certificate.
     - HTTP/2: Enabled.
   - **Port 80 (HTTP):**
     - Protocol: HTTP -> HTTP (or redirect automatically to 443).
4. **Health Check Probe:**
   - Protocol: HTTP
   - Path: `/api/v1/health`
   - Port: 5000
   - Interval: 10s
   - Timeout: 5s
   - Retries: 3
5. **WebSocket & Long-Polling Passthrough:**
   - Ensure WebSocket upgrade headers are passed directly to targets.

---

## 4. Containerized Multi-Instance Deployment

### 4.1 Building Production Image
```bash
# Build multi-stage optimized image
docker build -t lumina-lms:v2.0.0 .
```

### 4.2 Running Production Node via Docker
```bash
docker run -d \
  --name lumina-api-node \
  --restart unless-stopped \
  -p 5000:5000 \
  --env-file /etc/lumina/production.env \
  lumina-lms:v2.0.0
```

### 4.3 Deploying Isolated Piston Workers
On dedicated runner servers:
```bash
docker run -d \
  --name piston-worker \
  --restart unless-stopped \
  -p 2000:2000 \
  --privileged \
  -v /sys/fs/cgroup:/sys/fs/cgroup:ro \
  ghcr.io/engineer-man/piston:latest
```

---

## 5. Zero-Downtime Rolling Update Procedure

Because API nodes are completely stateless and coordinate through Redis:

1. Deploy new image to API Node 2:
   ```bash
   docker stop lumina-api-node-2
   docker rm lumina-api-node-2
   docker run -d --name lumina-api-node-2 --env-file /etc/lumina/production.env lumina-lms:v2.0.1
   ```
2. Wait for Hetzner Load Balancer health check probe to mark Node 2 healthy (`GET /api/v1/health` returns 200).
3. Deploy new image to API Node 1:
   ```bash
   docker stop lumina-api-node-1
   docker rm lumina-api-node-1
   docker run -d --name lumina-api-node-1 --env-file /etc/lumina/production.env lumina-lms:v2.0.1
   ```
4. Verify overall cluster readiness:
   ```bash
   curl -f http://localhost:5000/api/v1/ready
   ```
