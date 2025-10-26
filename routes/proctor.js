const express = require("express");
const { requireAuth, allowRoles, checkRole } = require("../middleware/auth");
const proctorController = require("../controllers/proctorController");

const router = express.Router();

// Auth guard for all proctor routes
router.use(requireAuth);

// Dashboard - Removed unused route

// Ca thi được phân công - chỉ giám thị
router.get("/assigned-sessions", checkRole("proctor"), proctorController.getAssignedSessions);

// Chi tiết ca thi - chỉ giám thị
router.get("/sessions/:sessionId/details", checkRole("proctor"), proctorController.getSessionDetails);

// Danh sách thí sinh trong ca thi - chỉ giám thị
router.get("/sessions/:sessionId/students", checkRole("proctor"), proctorController.getSessionStudents);

// Ghi nhận vi phạm - chỉ giám thị
router.post("/violations", checkRole("proctor"), proctorController.recordViolation);

// Khóa bài thi - chỉ giám thị
router.put("/attempts/:attemptId/lock", checkRole("proctor"), proctorController.lockAttempt);

// Báo cáo sự cố - chỉ giám thị
router.post("/incidents", checkRole("proctor"), proctorController.reportIncident);

// Xử lý báo lỗi câu hỏi - chỉ giám thị
router.get("/issue-reports", checkRole("proctor"), proctorController.getIssueReports);
router.put("/issue-reports/:reportId/resolve", checkRole("proctor"), proctorController.resolveIssueReport);

// Student monitoring - Removed unused route

// Lấy danh sách giám thị có sẵn - teacher và admin
router.get("/available", allowRoles("teacher", "admin"), proctorController.getAvailableProctors);

module.exports = router;