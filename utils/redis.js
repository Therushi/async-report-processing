const { createClient } = require("redis");

let cient = null;

async function getRedisClient() {
  if (client && client.isOpen) return client;
  client = createClient({ url: process.env.REDIS_URL });
  client.on("error", (err) => console.error("[Redis] Client error:", err));
  await client.connect();
  return client;
}

module.exports = { getRedisClient };
