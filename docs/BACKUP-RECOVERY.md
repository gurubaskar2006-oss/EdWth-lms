# Lumina LMS V3 — Backup & Recovery
**6th Civilians Corporation**

---

## 1. Database Backup (MongoDB Atlas)

Lumina's primary datastore is MongoDB Atlas, which provides:
- **Continuous cloud backups** (every 6 hours, point-in-time recovery)
- **Snapshots** retained for 7 days (configurable up to 35 days)

### Recommended Settings
```
Backup Schedule: Every 6 hours
Snapshot Retention: 14 days
Point-in-Time Recovery: Enabled
Oplog Window: 24 hours
```

### Manual Export (emergency / migration)
```bash
# Export a tenant's data (adjust filter)
mongodump \
  --uri="${MONGO_URI}" \
  --query='{"tenantId": ObjectId("...")}' \
  --collection=users \
  --out=./backup_$(date +%Y%m%d)

# Restore
mongorestore --uri="${MONGO_URI}" ./backup_20260920/
```

### Critical Collections to Back Up
| Collection | Criticality | Data Type |
|---|---|---|
| `users` | HIGH | Auth credentials, roles |
| `courses` | HIGH | Content |
| `assignments` | HIGH | Student work |
| `grades` | HIGH | Academic records |
| `notes` | MEDIUM | Study materials |
| `batches` | MEDIUM | Cohort structure |
| `auditlogs` | HIGH | Compliance records |
| `attendancesessions` | MEDIUM | Historical attendance |

---

## 2. Object Storage Backup (Backblaze B2)

Backblaze B2 stores: note attachments, syllabus PDFs, export archives.

B2 does NOT provide automatic versioning or backups by default.

### Enable B2 Versioning (Recommended)
```bash
# Enable file versioning on your bucket via B2 console or API
b2 update-bucket lumina-enterprise-storage --lifecycleRules '[...]'
```

### Periodic Archive
```bash
# Download all tenant files periodically using rclone
rclone sync \
  :s3,endpoint="${B2_ENDPOINT}",access_key_id="${B2_APPLICATION_KEY_ID}",secret_access_key="${B2_APPLICATION_KEY}":lumina-enterprise-storage \
  /mnt/backup/b2/$(date +%Y%m%d)
```

---

## 3. Redis (No Backup Required)

Redis in Lumina is used for:
- Socket.io pub/sub (transient, reconnects automatically)
- Rate limit counters (transient, acceptable to reset on restart)
- Token blacklist (optional, if implemented)

**Redis data is ephemeral by design.** If Redis is lost:
- Socket.io reconnects within seconds
- Rate limit windows reset (acceptable security tradeoff)
- No user data is stored in Redis

Redis persistence (RDB/AOF) is enabled in docker-compose for safety but recovery is not critical.

---

## 4. Disaster Recovery

### Scenario: MongoDB Atlas outage
- API degrades gracefully — falls back to in-memory local student data for auth
- All tenant-scoped routes return 503 (fail closed — no cross-tenant exposure)
- ETA for Atlas recovery: typically < 15 min for zonal failover
- Action: Monitor Atlas status page, alert DevOps

### Scenario: Redis outage
- Socket.io real-time features stop working until Redis recovers
- Security-sensitive rate-limited endpoints return 503 (fail closed)
- Non-critical API endpoints continue serving
- Action: Restart Redis container, monitor reconnection

### Scenario: Piston workers unavailable
- Code Lab returns HTTP 503 for all execution requests
- No fallback execution path — fail closed by design
- Action: Restart Piston containers, verify Docker networking

### Scenario: API node failure
- Hetzner LB detects failure via health check (`/api/v1/health`)
- Traffic routed to remaining healthy nodes automatically
- Action: Restart failed node, investigate logs

---

## 5. Recovery Time Objectives

| Component | RTO | RPO |
|---|---|---|
| MongoDB Atlas (zonal) | 5–15 min | 6 hours (snapshot) / seconds (PITR) |
| Redis | < 2 min | N/A (ephemeral) |
| Piston workers | < 2 min | N/A (stateless) |
| API node | < 1 min | N/A (stateless) |
| B2 storage | N/A (managed) | Per versioning config |
