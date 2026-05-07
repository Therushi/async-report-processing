const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const { getRedisClient } = require("./utils/redis");

const app = express();
const PORT = process.env.PORT || 3500;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/reports", require("./routes/report.routes"));

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Async Report Processing API",
    version: "1.0.0",
  });
});

app.use((err, req, res, next) => {
  console.error(`[Server] Unhandled error:`, err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  });
});

async function startServer() {
  await getRedisClient();
  console.log("[Redis] Cache client connected");

  require("./jobs/report.worker");
  console.log("[Worker] Report worker started");
  app.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[Server] Failed to start:", err);
  process.exit(1);
});

module.exports = app;
