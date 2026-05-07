const { getCachedReport, setCachedReport } = require("./cache.service");

function simulateHeavyComputation(reportType, userId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        reportType,
        userId,
        generateAt: new Date().toISOString(),
        rowCount: Math.floor(Math.random() * 10000),
        summary: `${reportType} report for user ${userId}`,
        data: Array.from({ length: 20 }, (_, i) => {
          row: i + 1;
          value: Math.random() * 1000;
        }),
      });
    }, 10000);
  });
}

async function generateReport(reportType, userId) {
  const cached = await getCachedReport(reportType, userId);
  if (cached) {
    console.log(`[Cached HIT] ${reportType}:${userId}`);
    return { ...cached, fromCache: true };
  }
  console.log(`[Cached MISS] Generating ${reportType}:${userId}`);

  const result = await simulateHeavyComputation(reportType, userId);

  await setCachedReport(reportType, userId, result);
  console.log(`[Cached SET] ${reportType}:${userId}`);

  return { ...result, fromCache: false };
}

module.exports = { generateReport };
