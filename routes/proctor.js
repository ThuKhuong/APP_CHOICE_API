const express = require("express");
const { requireAuth, allowRoles, checkRole } = require("../middleware/auth");
const proctorController = require("../controllers/proctorController");

const router = express.Router();

// Auth guard for all proctor routes
router.use(requireAuth);

// Dashboard - chỉ giám thị hoặc giáo viên có thể xem
router.get("/dashboard", allowRoles("proctor", "teacher"), proctorController.getDashboard);

// Ca thi được phân công - chỉ giám thị
router.get("/assigned-sessions", checkRole("proctor"), proctorController.getAssignedSessions);

// Chi tiết ca thi - chỉ giám thị
router.get("/sessions/:sessionId/details", checkRole("proctor"), proctorController.getSessionDetails);

// Ghi nhận vi phạm - chỉ giám thị
router.post("/violations", checkRole("proctor"), proctorController.recordViolation);

// Báo cáo sự cố - chỉ giám thị
router.post("/incidents", checkRole("proctor"), proctorController.reportIncident);

// Giám sát sinh viên - chỉ giám thị
router.get("/students/:studentId/monitor", checkRole("proctor"), proctorController.getStudentMonitor);

// Lấy danh sách giám thị có sẵn - teacher và admin
router.get("/available", allowRoles("teacher", "admin"), proctorController.getAvailableProctors);

module.exports = router;