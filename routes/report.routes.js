const { Router } = require("express");
const reportQueue = require("../jobs/report.queue");

const router = Router();

router.post("/", async (req, res) => {
  const { reportType, userId } = req.body;
  if (!reportType || !userId) {
    return res.status(400).json({
      success: false,
      error: "reportType and userId are required",
      code: "VALIDATION_ERROR",
    });
  }

  const job = await reportQueue.add("generate", { reportType, userId });

  return res.status(202).json({
    success: true,
    data: { jobId: job.id, status: "pending" },
    message: "Report generation queued",
  });
});

router.get("/:jobId/status", async (req, res) => {
  const { jobId } = req.params;
  const job = await reportQueue.getJob(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: `Job ${jobId} not found`,
      code: `JOB_NOT_FOUND`,
    });
  }

  const state = await job.getState();
  console.log(state, "This is state");
  const statusMap = {
    waiting: "pending",
    active: "processing",
    completed: "completed",
    failed: "failed",
    delayed: "pending",
    unknown: "pending",
  };
  const status = statusMap[state] || "pending";

  if (state === "failed") {
    return res.status(200).json({
      success: false,
      error: job.failedReason || "Job failed",
      code: "JOB_FAILED",
      data: { jobId, status, attemptsMade: job.attemptsMade },
    });
  }
  return res.status(200).json({
    success: true,
    data: {
      jobId,
      status,
      progress: job.progress || 0,
      attemptsMade: job.attemptsMade,
      result: state === "completed" ? job.returnvalue : undefined,
    },
  });
});

module.exports = router;
