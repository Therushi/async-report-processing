# Async Report Processing

A background report generation system built with Node.js, Express 5, BullMQ, and Redis. Heavy computation runs outside the HTTP request cycle — the API responds in milliseconds and a background worker processes the report asynchronously.

## Architecture Overview

```
Client → POST /reports → BullMQ Queue → Worker → Redis Cache
                ↓                                      ↑
          202 + jobId          GET /reports/:id/status ┘
```

**Three core features:**
1. **Job Queue** — BullMQ enqueues jobs; API returns `jobId` in < 5ms
2. **Retry & Status Tracking** — Exponential backoff with up to 3 attempts; status polling via REST
3. **Redis Caching** — Cache-aside pattern; workers check Redis before computing to skip recomputation on repeat requests

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 LTS (CommonJS) |
| HTTP | Express 5.x |
| Job Queue | BullMQ 5.x |
| Cache / Queue Store | Redis 7 |
| Config | dotenv |

---

## Project Structure

```
/utils
  redis.js            — node-redis singleton (for caching)
  queue.js            — BullMQ Queue/Worker factory (ioredis internally)
/jobs
  report.queue.js     — BullMQ Queue with retry config
  report.worker.js    — BullMQ Worker (processor)
/services
  cache.service.js    — Redis get/set/delete for report results
  report.service.js   — Business logic: cache-aside + report generation
/routes
  report.routes.js    — POST /reports, GET /reports/:jobId/status
index.js              — Entry point with async startServer()
.env                  — PORT, REDIS_URL, CACHE_TTL_SECONDS
Dockerfile            — Multi-stage build
docker-compose.yml    — Wires app + Redis together
.dockerignore         — Excludes node_modules, .env, dist
```

---

## Getting Started

### Option A — Docker (recommended)

```bash
# Build and start Redis + app
docker compose up --build -d

# Watch logs
docker compose logs -f

# Stop and remove containers
docker compose down

# Stop and wipe Redis data (named volume)
docker compose down -v
```

### Option B — Local (requires Redis running)

```bash
# Start Redis (if not already running)
redis-server

# Install dependencies
npm install

# Start server
node index.js
```

### Environment Variables

Create `.env` in the project root:

```
PORT=3500
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=3600
```

> **Note:** Docker Compose injects its own `REDIS_URL=redis://redis:6379` (service name, not `localhost`) via the `environment:` block — it does not read your `.env`.

---

## API Reference

### `POST /reports`

Enqueue a report generation job. Returns immediately with a `jobId`.

**Request:**
```bash
curl -X POST http://localhost:3500/reports \
  -H "Content-Type: application/json" \
  -d '{"reportType":"sales","userId":"user_42"}'
```

**Response — 202 Accepted:**
```json
{
  "success": true,
  "data": { "jobId": "1", "status": "pending" },
  "message": "Report generation queued"
}
```

---

### `GET /reports/:jobId/status`

Poll job status and retrieve the result when complete.

**While processing:**
```json
{
  "success": true,
  "data": { "jobId": "1", "status": "processing", "progress": 10, "attemptsMade": 1 }
}
```

**Completed:**
```json
{
  "success": true,
  "data": {
    "jobId": "1",
    "status": "completed",
    "progress": 100,
    "result": {
      "reportType": "sales",
      "userId": "user_42",
      "rowCount": 4821,
      "fromCache": false
    }
  }
}
```

**Failed (all retries exhausted):**
```json
{
  "success": false,
  "error": "Report generation failed after 3 attempts",
  "code": "JOB_FAILED",
  "data": { "jobId": "1", "status": "failed", "attemptsMade": 3 }
}
```

### BullMQ State → API Status Mapping

| BullMQ State | API `status` |
|---|---|
| `waiting` | `pending` |
| `active` | `processing` |
| `completed` | `completed` |
| `failed` | `failed` |
| `delayed` | `pending` |

---

## End-to-End Flow

```
1. POST /reports { reportType: "sales", userId: "user_42" }
   → BullMQ assigns jobId = "1", saves to Redis
   → 202: { jobId: "1", status: "pending" }          [~5ms]

2. Worker picks up job "1"
   → state = "active", progress = 10
   → getCachedReport("sales", "user_42") → CACHE MISS
   → simulateHeavyComputation()           → 3 seconds
   → setCachedReport(...)                 → stored with TTL
   → progress = 100, state = "completed"

3. GET /reports/1/status  (within 3s)  → status: "processing", progress: 10
4. GET /reports/1/status  (after 4s)   → status: "completed",  fromCache: false

5. POST /reports { same params }       → jobId: "2"
   → Worker: getCachedReport() → CACHE HIT, completes in < 100ms
   → GET /reports/2/status             → fromCache: true
```

---

## Key Design Decisions

### Two Redis clients
BullMQ uses `ioredis` internally (requires Lua scripts + transactions for atomic job state). The cache layer uses `node-redis` (simple get/set). Same Redis server, different client libraries.

### Cache-aside pattern
Workers check the cache before computing. Only caches what's actually requested — more efficient than write-through for reports that may never be re-requested.

### Retry config
```js
{ attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
// Attempt 1 fails → wait 1s → attempt 2 fails → wait 2s → attempt 3 fails → "failed"
```
Exponential backoff prevents thundering herd when downstream services are overloaded.

### `removeOnComplete: { count: 100 }`
Without this, every completed job stays in Redis forever → memory exhaustion. Keeps a sliding window of the 100 most recent completed jobs.

### `job.returnvalue`
Whatever the processor returns is stored by BullMQ in Redis. Retrieved via `job.returnvalue` on the status endpoint — no separate storage needed.

### Polling vs WebSockets
Polling is stateless and works behind any load balancer. WebSockets require sticky sessions. For infrequent report requests, polling at ~2s intervals is acceptable.

---

## Docker Details

### Multi-stage Dockerfile
- **Builder stage** — installs all deps
- **Runtime stage** — copies only production assets, installs `--omit=dev`
- `USER node` — never run as root inside a container
- `node:20-alpine` — ~50MB vs ~350MB for the full image

### `service_healthy` in `depends_on`
Plain `depends_on` waits for the container to *start*, not for Redis to be *ready*. The healthcheck (`redis-cli ping`) + `condition: service_healthy` eliminates the race condition on startup.

### Named volume for Redis
Containers are ephemeral — their filesystem is wiped on restart. The named volume `redis_data` persists BullMQ job data and cached reports independently of the container lifecycle.

---

## Useful Commands

```bash
# Rebuild only the app after code changes
docker compose up --build app -d

# Shell into the app container
docker compose exec app sh

# Redis CLI inside the Redis container
docker compose exec redis redis-cli

# See all Redis keys (BullMQ jobs + cached reports)
docker compose exec redis redis-cli KEYS '*'

# Stop without removing volumes
docker compose stop
```
