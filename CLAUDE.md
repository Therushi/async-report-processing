# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Async report processing service using Express, BullMQ (job queue), and Redis. The architecture separates HTTP endpoints from background job processing.

## Stack

- **Runtime**: Node.js (using CommonJS)
- **HTTP Framework**: Express 5.x
- **Job Queue**: BullMQ 5.x (leverages Redis for persistence)
- **Cache/Queue Store**: Redis 5.x
- **Config**: dotenv

**Note**: Project is configured as CommonJS (`"type": "commonjs"`). Future migration to ESM should align with async-report-processing v2+ if planned.

## Development & Running

### Start the server
```bash
node index.js
```
Server runs on `PORT` env var (default 3500).

### Environment Setup
Create `.env` in the root:
```
PORT=3500
REDIS_URL=redis://localhost:6379
```

### Dependencies Install
```bash
npm install
```

### Add new package
```bash
npm install <package-name>
```

## Project Structure (Planned)

The project currently has a minimal structure:
- `index.js` — Entry point, Express server setup
- More files will be added for job processing logic

**Future structure** (when adding job processing):
```
/jobs          — BullMQ queue definitions
  /report.js   — Report processing job queue
  /handlers/   — Job handlers (processors)
/routes        — Express route handlers
/services      — Business logic (report generation, DB queries, etc.)
/utils         — Helpers (Redis connections, queue setup)
```

## Architecture Notes

### Job Processing Pattern
1. **HTTP Endpoint** → Enqueue job to BullMQ
2. **BullMQ Processor** → Process job asynchronously (in separate process or worker)
3. **Completion** → Store result in Redis/DB or notify client via webhook/polling

Example (add later):
```javascript
// Enqueue report job
const queue = new Queue('reports', { connection: redis });
await queue.add('generate', { userId: 123 });

// Process job (worker.js or separate process)
queue.process('generate', async (job) => {
  // Generate report
  return result;
});
```

### Redis Connection
- Single Redis instance (localhost:6379 in dev)
- BullMQ handles connection pooling automatically
- For production, use `REDIS_URL` env var

### Error Handling
- Use try/catch for async operations
- Log errors with context (job ID, user ID, etc.)
- Failed jobs should be retried by BullMQ (configurable per queue)

## Testing

Currently no test setup. When adding tests:
- Use Jest (standard for Node.js)
- Mock Redis/BullMQ in unit tests
- Use real Redis in integration tests (optional Docker setup)

## Linting & Formatting

No linting config yet. Consider adding:
```bash
npm install --save-dev eslint prettier
```

## Common Commands (to add as needed)

```bash
npm test          # Run tests (set up later)
npm run lint      # Lint code (set up later)
npm run dev       # Dev mode with auto-reload (install nodemon)
npm run start     # Production start
```

## Key Files to Know

- **index.js** — HTTP server and middleware setup
- **package.json** — Dependencies and scripts

## Notes for Future Contributors

- BullMQ docs: https://docs.bullmq.io/
- Keep job processors pure (no side effects beyond the job result)
- Use job.data for input parameters, job.progress() for status updates
- Avoid long-running synchronous code in job handlers
- Consider using separate worker processes for heavy workloads (BullMQ supports this via `Worker` class)
