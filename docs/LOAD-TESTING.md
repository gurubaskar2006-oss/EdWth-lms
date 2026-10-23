# Lumina LMS V3 — Load Testing Guide
**6th Civilians Corporation**

---

## Purpose

This guide defines how to validate that Lumina's rate limits, execution queue limits,
and infrastructure can handle the expected concurrent load before production rollout.

> **Never run load tests against production.** Use a staging environment.

---

## 1. Tool: k6

```bash
# Install k6
choco install k6       # Windows
brew install k6        # macOS
sudo apt install k6    # Ubuntu
```

---

## 2. Baseline Load Test

Tests normal authenticated API usage.

```js
// k6/baseline.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m',  target: 50  },   // ramp up
    { duration: '3m',  target: 100 },   // sustained
    { duration: '1m',  target: 0   },   // ramp down
  ],
};

const BASE = 'http://localhost:80/api/v1';

export default function () {
  const auth = http.post(`${BASE}/auth/login`, JSON.stringify({
    identifier: 'student@nexus.edu',
    password: 'password'
  }), { headers: { 'Content-Type': 'application/json' } });

  check(auth, { 'login 200': (r) => r.status === 200 });

  const token = auth.json('token');
  const headers = { Authorization: `Bearer ${token}` };

  const courses = http.get(`${BASE}/data/courses`, { headers });
  check(courses, { 'courses 200': (r) => r.status === 200 });

  sleep(1);
}
```

```bash
k6 run k6/baseline.js
```

### Expected Results (Baseline)
| Metric | Acceptable |
|---|---|
| p95 response time | < 200ms |
| Error rate | < 0.1% |
| Login success rate | > 99% |

---

## 3. Rate Limit Validation Test

Validates that login rate limiting activates at the configured threshold.

```js
// k6/rate-limit-login.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 5,
  iterations: 60,  // 12 per VU = well over RATE_LIMIT_LOGIN_MAX=10
};

export default function () {
  const res = http.post('http://localhost:80/api/v1/auth/login',
    JSON.stringify({ identifier: 'test@test.com', password: 'wrong' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  // We expect some 401 (wrong password) and some 429 (rate limited)
  // Anything else is a failure
  check(res, {
    'status is 401 or 429': (r) => r.status === 401 || r.status === 429,
    'not 500': (r) => r.status !== 500,
  });
}
```

**Verify**: After 10 requests per IP in 15 minutes, subsequent requests return 429.

---

## 4. Code Execution Load Test

Validates queue limits (max 5 concurrent, 300 pending, 20s queue timeout).

```js
// k6/code-execution.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '30s',
};

export default function () {
  const res = http.post('http://localhost:80/api/v1/execute',
    JSON.stringify({
      language: 'python',
      code: 'print("hello world")',
      version: '3.10.0'
    }),
    { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer YOUR_TOKEN' } }
  );

  check(res, {
    'exec status valid': (r) => [200, 429, 503].includes(r.status),
  });

  sleep(0.5);
}
```

**Verify**:
- With 20 VUs, queue fills after 300 pending
- 503 returned when queue is full (not 500)
- Execution results return in < `CODE_EXECUTION_MAX_TIMEOUT` ms

---

## 5. Socket.io Tenant Isolation Verification

Manual test — cannot be automated with k6.

1. Create two tenants: `tenant_a` and `tenant_b`
2. Start an attendance session as Trainer A (tenant_a)
3. Connect as Trainer B (tenant_b)
4. Verify Trainer B does **not** receive `attendance:live_tally` events for tenant_a
5. Submit attendance as a student in tenant_a
6. Verify Trainer B still has 0 events

Expected: complete isolation between tenants' Socket.io rooms.

---

## 6. Recommended Rate Limit Values (Starting Points)

| Limit | Default | Recommendation after load test |
|---|---|---|
| `RATE_LIMIT_LOGIN_MAX` | 10 | Increase if legitimate users are hitting it |
| `RATE_LIMIT_CODE_MAX` | 60 | Decrease if Piston workers are saturated |
| `CODE_QUEUE_CONCURRENCY` | 5 | Scale with Piston worker count |
| `CODE_QUEUE_MAX_PENDING` | 300 | Decrease if queue wait time exceeds 10s |

Adjust all values through environment variables — no code changes required.

---

## 7. Monitoring During Load Tests

```bash
# Watch API node resource usage
docker stats lumina-api-node-1 lumina-api-node-2

# Watch Redis key counts (rate limit windows)
redis-cli -h localhost monitor | grep "rl:"

# Watch Piston queue
curl http://localhost:5000/api/v1/ready | jq .
```
