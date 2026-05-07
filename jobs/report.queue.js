const { createQueue } = require("../utils/queue");

const reportQueue = createQueue("reports", {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000,
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
});

module.exports = reportQueue;
