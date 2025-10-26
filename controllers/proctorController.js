const pool = require("../db");
const Session = require("../models/Session");
const User = require("../models/User");
const ProctorAssignment = require("../models/ProctorAssignment");
const ProctorDashboard = require("../models/ProctorDashboard");

// Removed unused getDashboard function

exports.getAssignedSessions = async function(req, res) {
  const proctorId = req.user.id;

  try {
    const sessions = await ProctorAssignment.getAssignedSessions(proctorId);
    res.json({ sessions });
  } catch (err) {
    console.error("Lỗi lấy ca thi được phân công:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getSessionDetails = async function(req, res) {
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
};

exports.getSessionStudents = async function(req, res) {
  const { sessionId } = req.params;
  const proctorId = req.user.id;

  try {
    const data = await ProctorAssignment.getSessionStudents(sessionId, proctorId);
    res.json(data);
  } catch (err) {
    console.error("Lỗi lấy danh sách thí sinh:", err.message);
    if (err.message === "Bạn không được phân công ca thi này") {
      return res.status(403).json({ message: err.message });
    }
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.recordViolation = async function(req, res) {
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
};

exports.lockAttempt = async function(req, res) {
  const { attemptId } = req.params;
  const proctorId = req.user.id;
  const { reason, violation_type = 'other' } = req.body;

  try {
    // Kiểm tra quyền khóa bài thi
    const result = await ProctorAssignment.lockAttempt(attemptId, proctorId, reason);
    
    // Sử dụng Stored Procedure để khóa bài và tính điểm
    await pool.query(
      'SELECT sp_lock_attempt_for_violation($1, $2, $3)',
      [attemptId, violation_type, reason]
    );
    
    res.json({ message: "Khóa bài thi thành công", attempt: result });
  } catch (err) {
    console.error("Lỗi khóa bài thi:", err.message);
    if (err.message === "Bạn không có quyền khóa bài thi này") {
      return res.status(403).json({ message: err.message });
    }
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.reportIncident = async function(req, res) {
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
};

// Removed unused getStudentMonitor function

exports.getAvailableProctors = async function(req, res) {
  try {
    const proctors = await User.getAvailableProctors();
    res.json(proctors);
  } catch (err) {
    console.error("Lỗi lấy danh sách giám thị có sẵn:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getIssueReports = async function(req, res) {
  const proctorId = req.user.id;

  try {
    const reports = await ProctorAssignment.getIssueReports(proctorId);
    res.json(reports);
  } catch (err) {
    console.error("Lỗi lấy danh sách báo lỗi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.resolveIssueReport = async function(req, res) {
  const { reportId } = req.params;
  const proctorId = req.user.id;
  const { action, replacement_question_id, note } = req.body;

  try {
    const result = await ProctorAssignment.resolveIssueReport(reportId, proctorId, action, replacement_question_id, note);
    res.json({ message: "Xử lý báo lỗi thành công", result });
  } catch (err) {
    console.error("Lỗi xử lý báo lỗi:", err.message);
    if (err.message === "Bạn không có quyền xử lý báo lỗi này") {
      return res.status(403).json({ message: err.message });
    }
    res.status(500).json({ message: "Lỗi server" });
  }
};
