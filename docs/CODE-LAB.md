# Lumina Code Lab — Execution Engine Architecture
**Platform Owner:** 6th Civilians Corporation

---

## 1. Architectural Principles

The Lumina Code Lab enables multi-language interactive programming and automated challenge assessment for thousands of concurrent students. To maintain rock-solid platform stability and prevent denial-of-service vulnerabilities, the execution engine follows three architectural pillars:

1. **Host Server Decoupling:** Student code is never executed on the Node.js API host.
2. **Bounded Concurrency Queue:** Surges in code submissions are queued and processed with strict worker capacity limits.
3. **Fail-Closed Security:** In production, execution fails closed if isolated workers are offline.

---

## 2. Concurrency Queue (`executionQueue`)

The execution queue (`server/services/executionQueue.js`) manages the rate of incoming execution requests:

| Parameter | Value | Behavior on Exceeded |
|---|---|---|
| **Max Concurrency** | 5 simultaneous jobs | Jobs wait in FIFO queue |
| **Max Queue Depth** | 300 waiting jobs | Immediate rejection with `HTTP 429 Too Many Requests` |
| **Max Queue Wait** | 20,000 ms (20 seconds) | Aborted with `HTTP 504 Gateway Timeout` |
| **Execution Timeout** | 10,000 ms (10 seconds) | Process terminated with `Time Limit Exceeded` |
| **Output Ceiling** | 100 KB | Output truncated with warning appended |

### Telemetry Endpoint
Inspect live queue stats at any time:
```http
GET /api/v1/execute/queue
Authorization: Bearer <token>
```
Response:
```json
{
  "success": true,
  "data": {
    "activeWorkers": 2,
    "queuedJobs": 5,
    "maxConcurrency": 5,
    "maxQueueLength": 300,
    "totalProcessed": 1240,
    "totalRejected": 0
  }
}
```

---

## 3. Isolated Piston Service (`pistonService`)

Execution is handled by self-hosted Piston worker instances.

### Supported Language Runtimes
- **Python 3.10** (`python`, `py`, `python3`)
- **JavaScript Node 18** (`javascript`, `js`, `node`)
- **C++ 10.2** (`c++`, `cpp`)
- **C 10.2** (`c`)
- **Java 15** (`java`)
- **SQLite 3.36** (`sqlite`, `sqlite3`, `sql`)
- **Bash 5.2** (`bash`)

### Production Fail-Closed Rule
```javascript
if (isProduction && !pistonAvailable) {
  return {
    success: false,
    status: 503,
    message: "Isolated execution service is currently unavailable. Execution is halted in production for platform security.",
    error: "ISOLATED_RUNNER_UNAVAILABLE"
  };
}
```
In development mode (`NODE_ENV !== 'production'`), a safe simulated fallback provides mock evaluation so developers can work offline without Docker.

---

## 4. Automated Challenge Assessment (`POST /api/v1/execute/test`)

The challenge evaluation endpoint accepts student code alongside test cases:
1. Wraps student solution inside an isolated test runner harness.
2. Injects arguments from `testCases[i].args`.
3. Compares stringified actual output against expected output.
4. Returns granular pass/fail telemetry per test case with syntax error capture.
