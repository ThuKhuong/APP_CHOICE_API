const express = require("express");
const { requireAuth, allowRoles } = require("../middleware/auth");
const studentController = require("../controllers/studentController");

const router = express.Router();

// Auth guard for all student routes
router.use(requireAuth);

// Bắt đầu làm bài thi
router.post("/start", allowRoles("student"), studentController.startExam);

// Lưu đáp án của sinh viên
router.post("/answer", allowRoles("student"), studentController.saveAnswer);

// Bỏ chọn đáp án
router.delete("/answer", allowRoles("student"), studentController.removeAnswer);

// Nộp bài thi
router.post("/submit", allowRoles("student"), studentController.submitExam);

// Xem chi tiết bài thi đã làm
router.get("/attempts/:id", allowRoles("student"), studentController.getAttemptDetails);

// Lấy lịch sử thi của sinh viên
router.get("/history", allowRoles("student"), studentController.getStudentHistory);

module.exports = router;