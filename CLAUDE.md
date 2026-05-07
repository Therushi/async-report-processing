# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Async report processing service using Express, BullMQ (job queue), and Redis. HTTP endpoints enqueue jobs; a BullMQ worker processes them in the background with caching and retry logic.

## Stack

- **Runtime**: Node.js, CommonJS (`"type": "commonjs"`) — use `require()`/`module.exports`
- **HTTP**: Express 5.x
- **Job Queue**: BullMQ 5.x
- **Cache/Queue Store**: Redis 5.x (two separate clients — see below)
- **Config**: dotenv

## Commands

```bash
node index.js          # start server (default port 3500)
```

No test runner, linter, or dev-reload script is configured yet.

## Environment Variables

```
PORT=3500
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=3600    # optional, defaults to 3600
```

## Architecture

### Request flow

```
POST /reports  →  report.routes.js  →  reportQueue.add()  →  BullMQ (Redis)
                                                                     ↓
                                                          report.worker.js
                                                                     ↓
                                                          report.service.js
                                                          (cache check → simulate → cache set)
```

### Two Redis connections

BullMQ and the cache service use **separate** Redis connections:

- `utils/queue.js` — parses `REDIS_URL` into `{ host, port }` for BullMQ's `Queue` and `Worker`
- `utils/redis.js` — singleton `redis` client (full URL) used by `cache.service.js`

Do not mix them. BullMQ requires the raw host/port form; the `redis` package accepts the full URL.

### Worker lifecycle

The worker (`jobs/report.worker.js`) is loaded inside `startServer()` in `index.js` — it runs in-process, not as a separate process. Concurrency is set to 5. The queue is configured with 3 retry attempts and exponential backoff (1 s base).

### Cache

`services/cache.service.js` stores results in Redis under the key `report:cache:{reportType}:{userId}`. `generateReport()` is cache-aware: cache hit → return immediately with `fromCache: true`; miss → run `simulateHeavyComputation()` (10 s delay), store result, return with `fromCache: false`.

### API shape

```json
{ "success": true,  "data": {}, "message": "" }
{ "success": false, "error": "", "code": "" }
```

`POST /reports` returns `202` with `{ jobId, status: "pending" }`.  
`GET /reports/:jobId/status` polls job state; maps BullMQ states to `pending / processing / completed / failed`.

## Known Bugs in Current Code

- **`utils/redis.js` line 3**: variable declared as `cient` (typo) but referenced as `client` — causes a ReferenceError on first call.
- **`routes/report.routes.js` line 1**: destructures `{ router, Router }` from express then immediately shadows it with `const router = Router()` — `router` from the destructure is unused/wrong; remove it from the destructure.
- **`services/report.service.js` lines 13–14**: object literal inside `Array.from` callback uses statement syntax (`row: i+1; value: ...`) instead of a returned object — all array entries will be `undefined`.
- **`routes/report.routes.js` line 59**: status endpoint returns `success: false` on a successful status lookup — should be `success: true`.
