const { getRedisClient } = require("../utils/redis");

const CACHE_PREFIX = "report:cache";
const TTL = parseInt(process.env.CACHE_TTL_SECONDS || "3600");

function buildCacheKey(reportType, userId) {
  return `${CACHE_PREFIX}:${reportType}:${userId}`;
}

async function getCachedReport(reportType, userId) {
  const redis = await getRedisClient();
  const raw = await redis.get(buildCacheKey(reportType, userId));
  if (!raw) return null;
  return JSON.parse(raw);
}

async function setCachedReport(reportType, userId, data) {
  const redis = await getRedisClient();
  await redis.setEx(
    buildCacheKey(reportType, userId),
    TTL,
    JSON.stringify(data),
  );
}

async function deleteCachedReport(reportType, userId) {
  const redis = await getRedisClient();
  await redis.del(buildCacheKey(reportType, userId));
}

module.exports = { getCachedReport, setCachedReport, deleteCachedReport };
