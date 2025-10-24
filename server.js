// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth"); // route login
const teacherRoutes = require("./routes/teacher"); // route cho GV
const studentRoutes = require("./routes/student"); // route cho SV
const proctorRoutes = require("./routes/proctor"); // route cho giám thị
const adminRoutes = require("./routes/admin"); // route cho admin

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/proctor", proctorRoutes);
app.use("/api/admin", adminRoutes);

// Endpoint health kiểm tra DB
const pool = require("./db");
app.get("/health/db", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Error handler chuẩn
app.use((err, req, res, next) => {
  console.error("[ERROR]", err);
  res.status(err.status || 500).json({
    code: err.code || "SERVER_ERROR",
    message: err.message || "Lỗi server",
  });
});

// Import job scheduler
const scheduler = require('./scheduler/sessionStatusScheduler.js');

const PORT = 3000;
const server = app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Scheduler: Running every 1s`);
  
  // Start job scheduler khi server start
  scheduler.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  scheduler.stop();
  server.close(() => {
    console.log('Closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  scheduler.stop();
  server.close(() => {
    console.log('Closed');
    process.exit(0);
  });
});

module.exports = app;
