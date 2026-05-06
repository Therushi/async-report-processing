const { Queue, Worker } = require("bullmq");

const redisConnection = {
  host: new URL(process.env.REDIS_URL || "redis://localhost:6379").hostname,
  port: parseInt(
    new URL(process.env.REDIS_URL || "redis://localhost:6379").port || "6379",
  ),
};

function createQueue(name, defaultJobOptions = {}) {
  return new Queue(name, {
    connection: redisConnection,
    defaultJobOptions,
  });
}

function createWorker(name, processor, opts = {}) {
  return new Worker(name, processor, {
    connection: redisConnection,
    ...opts,
  });
}

module.exports = { createQueue, createWorker };
