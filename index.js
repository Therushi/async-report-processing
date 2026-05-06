const dotenv = require("dotenv");
const express = require("express");
const app = express();

dotenv.config();

const PORT = process.env.PORT || 3500;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  console.log(`Req has arrived`);
  const userInfo = {
    method: req.method,
    path: req.path,
    query: req.query,
    headers: req.headers,
    ip: req.ip,
  };

  return res.status(200).json({
    data: userInfo,
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
