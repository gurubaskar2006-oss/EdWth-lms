# Lumina LMS V2 — Enterprise System Architecture
**Platform Owner:** 6th Civilians Corporation  
**Classification:** Enterprise Tier Production Infrastructure

---

## 1. Architectural Overview

Lumina LMS V2 is designed as a horizontally scalable, multi-tenant learning management and automated code assessment platform. The architecture cleanly decouples edge ingress, stateless compute, distributed real-time state, primary persistence, object storage, and untrusted code execution.

```
                                  [Internet Clients]
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │        Hetzner Load Balancer          │
                      │  - Anycast Ingress & DDoS Mitigation  │
                      │  - Automated TLS 1.3 Termination      │
                      │  - Round-Robin Backend Distribution   │
                      └──────────────────┬────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
   ┌───────────────────────────┐                   ┌───────────────────────────┐
   │    Lumina API Node 1      │                   │    Lumina API Node 2      │
   │  - Stateless Express      │                   │  - Stateless Express      │
   │  - JWT & RBAC Middleware  │                   │  - JWT & RBAC Middleware  │
   │  - Tenant Partitioning    │                   │  - Tenant Partitioning    │
   │  - Socket.io Gateway      │                   │  - Socket.io Gateway      │
   └─────────────┬─────────────┘                   └─────────────┬─────────────┘
                 │                                               │
                 ├───────────────────────┬───────────────────────┤
                 ▼                       ▼                       ▼
   ┌───────────────────────────┐ ┌───────────────┐ ┌───────────────────────────┐
   │      Redis 7 Cluster      │ │ MongoDB Atlas │ │       Backblaze B2        │
   │ - Socket.io Redis Adapter │ │ - Multi-Tenant│ │ - S3-Compatible Storage   │
   │ - Distributed Pub/Sub     │ │   Partitions  │ │ - Media, PDF Syllabus,    │
   │ - Token Revocation Cache  │ │ - Compound    │ │   Verified CSV Exports    │
   │ - Rate Limit Counters     │ │   Indexes     │ │ - Presigned Short URLs    │
   └───────────────────────────┘ └───────────────┘ └───────────────────────────┘
                 │
                 ▼
   ┌───────────────────────────────────────────────────────────┐
   │             Execution Concurrency Queue                   │
   │   - Capacity: Max 5 Concurrent Active Workers             │
   │   - Queue Depth: Max 300 Waiting Requests                 │
   │   - Timeout: 20s Max Queue Wait, 10s Execution Ceiling    │
   └─────────────────────────────┬─────────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
   ┌───────────────────────────┐   ┌───────────────────────────┐
   │     Piston Worker 1       │   │     Piston Worker 2       │
   │  - Isolated Docker Cgroup │   │  - Isolated Docker Cgroup │
   │  - 128MB RAM Hard Ceiling │   │  - 128MB RAM Hard Ceiling │
   │  - No Host Access         │   │  - No Host Access         │
   │  - Output Bounded (100KB) │   │  - Output Bounded (100KB) │
   └───────────────────────────┘   └───────────────────────────┘
```

---

## 2. Infrastructure Component Specifications

### 2.1 Edge & Ingress Layer: Hetzner Load Balancer
- **Role:** Primary public ingress, Anycast DNS routing, DDoS mitigation, and SSL/TLS termination.
- **TLS Configuration:** Let's Encrypt automated certificates, TLS 1.2/1.3 only, Strict-Transport-Security (HSTS).
- **Session Strategy:** Stateless round-robin load distribution.
- **Local Testing Simulation:** For local developer testing without Hetzner infrastructure, `docker-compose.yml` provides a lightweight Nginx reverse proxy. **In production, the managed Hetzner Load Balancer is used exclusively.**

### 2.2 Application Layer: Lumina API Cluster
- **Runtime:** Node.js v20 on Alpine Linux.
- **Execution Model:** Unprivileged non-root user (`node`), managed by `dumb-init` for POSIX signal handling.
- **Stateless Design:** Nodes do not maintain sticky in-memory session state, allowing instant zero-downtime rolling updates and auto-scaling behind the load balancer.
- **Probes:**
  - `GET /api/v1/health` — Liveness probe (uptime, memory, process state).
  - `GET /api/v1/ready` — Readiness probe (validates database, Redis, and Piston runner).

### 2.3 Real-Time Coordination: Redis 7 Bus & Adapter
- **Role:** Coordinates multi-instance Socket.io broadcasts and real-time event distribution.
- **Implementation:** `@socket.io/redis-adapter` with dual pub/sub connections.
- **Sticky Session Decoupling:** Cross-instance real-time synchronization is coordinated horizontally via Redis pub/sub. Nodes do not rely on brittle IP-hash sticky sessions.
- **Tenant Isolation:** Socket rooms are partitioned by tenant: `tenant:{tenantId}`, `tenant:{tenantId}:role:{role}`, `tenant:{tenantId}:batch:{batchId}`.

### 2.4 Primary Persistence: MongoDB Atlas
- **Role:** Primary document database for users, colleges, courses, assignments, and audit trails.
- **Multi-Tenancy Guardrail:** Every tenant-scoped collection uses compound indexing on `{ tenantId: 1, ... }` to enforce tenant isolation and prevent cross-tenant ID collisions.
- **Reliability:** Automated point-in-time recovery (PITR) and replica set high availability.

### 2.5 Code Lab Isolation Engine: Piston Runner Pool
- **Role:** Compiles and executes untrusted code submitted by students.
- **Architecture:** Zero `child_process` execution on the host server. Requests pass through an in-memory bounded concurrency queue (`executionQueue`) to isolated Piston worker containers.
- **Constraints:**
  - Hard memory limit: 128 MB per execution.
  - CPU timeout ceiling: 10 seconds.
  - Output truncation: 100 KB maximum stdout/stderr buffer.
- **Fail-Closed Security Rule:** When `NODE_ENV === 'production'`, if Piston workers are offline or unreachable, execution **strictly halts and returns HTTP 503**. Local host fallback is permanently disabled in production.

### 2.6 Media & Document Store: Backblaze B2 Object Storage
- **Role:** Dedicated S3-compatible object storage for uploaded notes, PDF syllabus documents, and exported attendance CSV logs.
- **Architectural Scope:** Backblaze B2 is strictly used as **Object Storage**. Edge routing, CDN distribution, and security filtering are handled by the dedicated edge infrastructure (Hetzner Load Balancer).
- **Access Control:** Short-lived presigned URLs (60-minute expiry) with MIME magic byte binary verification.
