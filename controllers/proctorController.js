const pool = require("../db");
const Session = require("../models/Session");
const User = require("../models/User");
const ProctorAssignment = require("../models/ProctorAssignment");
const ProctorDashboard = require("../models/ProctorDashboard");

async function getDashboard(req, res) {
  try {
    const data = await ProctorDashboard.getDashboardData();
    res.json(data);
  } catch (err) {
    console.error("Lỗi lấy dashboard:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function getAssignedSessions(req, res) {
  const proctorId = req.user.id;

  try {
    const sessions = await ProctorAssignment.getAssignedSessions(proctorId);
    res.json({ sessions });
  } catch (err) {
    console.error("Lỗi lấy ca thi được phân công:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function getSessionDetails(req, res) {
  const { sessionId } = req.params;
  const proctorId = req.user.id;

  try {
    const data = await ProctorAssignment.getSessionDetails(sessionId, proctorId);
    res.json(data);
  } catch (err) {
    console.error("Lỗi lấy chi tiết ca thi:", err.message);
    if (err.message === "Bạn không được phân công ca thi này") {
      return res.status(403).json({ message: err.message });
    }
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function recordViolation(req, res) {
  const { attempt_id, type, description } = req.body;
  const proctorId = req.user.id;

  try {
    const violation = await ProctorDashboard.recordViolation(attempt_id, proctorId, type, description);
    res.json({ message: "Ghi nhận vi phạm thành công", violation });
  } catch (err) {
    console.error("Lỗi ghi nhận vi phạm:", err.message);
    if (err.message === "Bạn không có quyền ghi nhận vi phạm cho sinh viên này") {
      return res.status(403).json({ message: err.message });
    }
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function reportIncident(req, res) {
  const { session_id, type, description, severity } = req.body;
  const proctorId = req.user.id;

  try {
    const incident = await ProctorDashboard.reportIncident(session_id, proctorId, type, description, severity);
    res.json({ message: "Báo cáo sự cố thành công", incident });
  } catch (err) {
    console.error("Lỗi báo cáo sự cố:", err.message);
    if (err.message === "Bạn không được phân công ca thi này") {
      return res.status(403).json({ message: err.message });
    }
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function getStudentMonitor(req, res) {
  const { studentId } = req.params;
  const proctorId = req.user.id;

  try {
    const data = await ProctorDashboard.getStudentMonitor(studentId, proctorId);
    res.json(data);
  } catch (err) {
    console.error("Lỗi lấy thông tin giám sát sinh viên:", err.message);
    if (err.message === "Không tìm thấy sinh viên hoặc bạn không được phân công giám sát") {
      return res.status(404).json({ message: err.message });
    }
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function getAvailableProctors(req, res) {
  try {
    const proctors = await User.getAvailableProctors();
    res.json(proctors);
  } catch (err) {
    console.error("Lỗi lấy danh sách giám thị có sẵn:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

module.exports = {
  getDashboard,
  getAssignedSessions,
  getSessionDetails,
  recordViolation,
  reportIncident,
  getStudentMonitor,
  getAvailableProctors,
};
