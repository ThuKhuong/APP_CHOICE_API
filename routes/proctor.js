const express = require("express");
const { requireAuth, allowRoles } = require("../middleware/auth");
const proctorController = require("../controllers/proctorController");

const router = express.Router();

// Auth guard for all proctor routes
router.use(requireAuth);

// Lấy dashboard tổng quan
router.get("/dashboard", allowRoles("teacher", "proctor"), proctorController.getDashboard);

// Lấy ca thi được phân công
router.get("/assigned-sessions", allowRoles("proctor"), proctorController.getAssignedSessions);

// Lấy chi tiết ca thi
router.get("/sessions/:sessionId/details", allowRoles("proctor"), proctorController.getSessionDetails);

// Ghi nhận vi phạm
router.post("/violations", allowRoles("proctor"), proctorController.recordViolation);

// Báo cáo sự cố
router.post("/incidents", allowRoles("proctor"), proctorController.reportIncident);

// Lấy thông tin giám sát sinh viên chi tiết
router.get("/students/:studentId/monitor", allowRoles("proctor"), proctorController.getStudentMonitor);

module.exports = router;