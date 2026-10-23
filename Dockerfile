# ========================================================
# Lumina LMS V2 - Production Multi-Stage Dockerfile
# 6th Civilians Corporation
# ========================================================

# --- Stage 1: Build Frontend Assets ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build Vite production bundle
COPY . .
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:20-alpine AS runner

# Install dumb-init for proper signal handling and curl for health probes
RUN apk add --no-cache dumb-init curl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy package descriptors and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled frontend from builder
COPY --from=builder /app/dist ./dist

# Copy backend server code
COPY --from=builder /app/server ./server
COPY --from=builder /app/index.html ./
COPY --from=builder /app/trainer.html ./
COPY --from=builder /app/admin.html ./

# Set ownership to unprivileged user 'node'
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose API and WebSocket port
EXPOSE 5000

# Container Healthcheck (Liveness Probe)
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/v1/health || exit 1

# Process signal forwarder
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start Lumina Enterprise Server
CMD ["node", "server/server.js"]
