# Lumina LMS V3 — Security Model
**6th Civilians Corporation**

> Last updated: V3 hardening cycle

---

## Authentication Boundary

```
Request
 ↓
JWT verification (stateless, cryptographic)
 ↓
DB lookup (verifies account still exists and is active)
 ↓
Tenant context extraction (from DB record — never from client)
 ↓
RBAC (role from DB record)
 ↓
Resource authorization (tenantId-scoped query)
 ↓
Controller
```

**JWT payload contains only `{ id }`** — the token is not trusted for role or tenant information. Every request does a DB lookup to get current account state. This means account suspension takes effect on the next request without waiting for token expiry.

---

## Tenant Isolation Architecture

All tenant-sensitive routes use the `requireTenantContext()` guard:

```
Authenticated request
       ↓
req.tenantId present and valid ObjectId?
         ↓                      ↓
        YES                     NO
         ↓                      ↓
tenant-scoped query          HTTP 403
                         MISSING_TENANT_CONTEXT
```

**There are no `{}` fallback queries.** Every route that touches tenant data fails closed if tenantId is missing.

### Affected Resources (all fail-closed)
- Courses, Assignments, Grades, Notes, Files
- Users, Batches, Sessions, Attendance
- Announcements, Doubts (Socket.io)
- Code Lab records, Admin operations

---

## Rate Limiting

Production uses Redis-backed distributed rate limiting coordinated across all API nodes. This is essential in a multi-node deployment — per-process in-memory limiters would allow an attacker to bypass limits by routing across nodes.

| Endpoint | Limit | Window | Redis-down behavior |
|---|---|---|---|
| Login | 10 req | 15 min | Fail closed (503) |
| 2FA verify | 5 req | 15 min | Fail closed (503) |
| Password reset | 5 req | 1 hour | Fail closed (503) |
| Code execution | 60 req | 1 min | Fail closed (503) |
| File uploads | 20 req | 1 min | Allow (non-critical) |
| Admin endpoints | 200 req | 1 min | Allow (non-critical) |
| General API | 300 req | 1 min | Allow (non-critical) |

All values are configurable via environment variables. Tune after load testing.

---

## Socket.io Tenant Isolation

All Socket.io broadcasts are tenant-scoped. Room naming convention:

```
tenant:{tenantId}:role:{role}          → role-specific events within a tenant
tenant:{tenantId}:batch:{batchId}      → batch-specific announcements
tenant:{tenantId}                      → all users of a tenant
```

**No global role rooms** are used for sensitive events. `attendance:live_tally`, `announcement:new`, and `doubt:new` are all scoped to `tenant:{tenantId}:*` rooms.

---

## Code Lab Isolation

Untrusted student code is **never executed inside the main API process**.

```
Student submits code
        ↓
API validates language + timeout (server enforces maximum — client value ignored)
        ↓
Execution queue (bounded: max 5 concurrent, 300 pending)
        ↓
Piston worker container (isolated, resource-limited)
        ↓
Result returned
```

**Fail-closed in production**: If all Piston workers are unreachable, the API returns HTTP 503. There is no fallback execution path.

Client-supplied `run_timeout` values are clamped to the server's `CODE_EXECUTION_MAX_TIMEOUT`.

---

## Input Validation Philosophy

Validation **rejects** bad input — it does not silently transform it.

```
Validate
   ↓
Reject invalid input (400 Bad Request)
   ↓
Normalize deliberately (trim whitespace, lowercase email)
   ↓
Business logic
```

**Authentication identifiers** (email/studentId) are normalized with `trim().toLowerCase()` before comparison.

**Passwords** are never sanitized or rewritten — only validated for minimum requirements, then bcrypt-hashed with cost factor 12.

**Arbitrary string fields** (course titles, note content, announcement text) are validated for type and length, but not transformed.

**MongoDB queries** are never built from arbitrary user objects. All query parameters are explicitly mapped.

---

## ReDoS Prevention

User-supplied strings are **escaped before use in MongoDB `$regex`** queries using:

```js
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
```

This applies in:
- `authController.js` (login identifier lookup)
- `authMiddleware.js` (legacy token fallback lookup)

---

## Audit Logging

Events are categorized by criticality:

### Critical Events (awaited, errors surfaced)
These events **must** produce a DB record. The caller handles failure explicitly.

| Action | Trigger |
|---|---|
| `AUTH_LOGIN_FAILED` | Failed password or account-not-found |
| `AUTH_2FA_FAILED` | Invalid TOTP code |
| `AUTH_PASSWORD_RESET` | Password changed |
| `ADMIN_TRAINER_CREATED` | New trainer account provisioned |
| `ADMIN_USER_SUSPENDED` | Account disabled |
| (future) `CROSS_TENANT_ACCESS_ATTEMPT` | Detected isolation bypass |

### Standard Events (fire-and-forget)
These are non-critical operational events. Failures are logged but not propagated.

| Action | Trigger |
|---|---|
| `AUTH_LOGIN_SUCCESS` | Successful password login |
| `AUTH_LOGIN_SUCCESS` (2FA) | Successful 2FA verification |

**Future**: Critical events should be queued to Redis before MongoDB write for durability during DB outages.

---

## Object Storage (B2) Security

- Storage credentials are only on the server — never exposed to clients.
- File uploads are validated for MIME type and size (`25 MB` max) by multer + `file-type` magic byte verification.
- Downloads use time-limited presigned URLs (1 hour default, configurable).
- B2 storage keys are scoped per-tenant using path prefix: `tenants/{tenantId}/...`
- Students, Trainers, and Admins cannot access each other's files due to server-side key construction.

---

## Infrastructure Visibility Policy

| Role | Can see |
|---|---|
| Student | Nothing about infrastructure |
| Trainer | Nothing about infrastructure |
| Admin | `/api/v1/admin/overview` (business metrics only) |
| Operations (DevOps) | `/api/v1/health`, `/api/v1/ready` (infrastructure health only) |

Infrastructure information (MongoDB state, Redis state, Piston URLs, API node internals, queue depth) is never returned in authenticated API responses to normal users.
