const { createWorker } = require("../utils/queue");
const { generateReport } = require("../services/report.service");

const reportWorker = createWorker(
  "reports",
  async (job) => {
    const { reportType, userId } = job.data;

    console.log(
      `[Worker] job ${job.id} | type=${reportType} user=${userId} attempt=${job.attemptsMade + 1}`,
    );

    await job.updateProgress(10);

    const result = await generateReport(reportType, userId);

    await job.updateProgress(100);

    return result;
  },
  {
    concurrency: 5,
  },
);

reportWorker.on("completed", (job) => {
  console.log(
    `[worker] job ${job.id} completed | fromCache=${job.returnvalue?.fromCache}`,
  );
});

reportWorker.on("failed", (job, err) => {
  console.log(
    `[worker] job ${job.id} failed (attempt ${job?.attemptsMade} | ${err.message})`,
  );
});

reportWorker.on("error", (err) => {
  console.error(`[worker] Worker error:`, err);
});

module.exports = reportWorker;
