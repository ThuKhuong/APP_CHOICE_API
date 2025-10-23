const express = require("express");
const pool = require("../db");
const { requireAuth, allowRoles } = require("../middleware/auth");
const teacherController = require("../controllers/teacherController");

const router = express.Router();

// Đăng ký tài khoản giáo viên
router.post("/auth/register", teacherController.registerTeacher);

// Đăng nhập giáo viên
router.post("/auth/login", teacherController.loginTeacher);

// Auth guard for all routes below
router.use(requireAuth);

// SUBJECTS - Môn học
router.post("/subjects", allowRoles("teacher"), teacherController.createSubject);
router.get("/subjects", allowRoles("teacher"), teacherController.listSubjects);
router.put("/subjects/:id", allowRoles("teacher"), teacherController.updateSubjectById);
router.delete("/subjects/:id", allowRoles("teacher"), teacherController.deleteSubjectById);

// CHAPTERS - Chương
router.get("/subjects/:subjectId/chapters", allowRoles("teacher"), teacherController.listChaptersBySubject);
router.post("/subjects/:subjectId/chapters", allowRoles("teacher"), teacherController.createChapterForSubject);
router.put("/chapters/:id", allowRoles("teacher"), teacherController.updateChapterById);
router.delete("/chapters/:id", allowRoles("teacher"), teacherController.deleteChapterById);

// QUESTIONS - Câu hỏi
router.post("/questions", allowRoles("teacher"), teacherController.createQuestion);
router.get("/questions", allowRoles("teacher"), teacherController.listQuestions);
router.get("/questions/:subjectId", allowRoles("teacher"), teacherController.getQuestionsBySubject);
router.get("/chapters/:chapterId/questions", allowRoles("teacher"), teacherController.getQuestionsByChapterForReplacement);
router.put("/questions/:id", allowRoles("teacher"), teacherController.updateQuestion);
router.delete("/questions/:id", allowRoles("teacher"), teacherController.deleteQuestion);
router.get("/subjects/:subjectId/question-stats", allowRoles("teacher"), teacherController.getQuestionStats);

// EXAMS - Đề thi
router.get("/exams", allowRoles("teacher"), teacherController.listExams);
router.post("/exams", allowRoles("teacher"), teacherController.createExam);
router.post("/exams/generate-preview", allowRoles("teacher"), teacherController.generateExamPreview);
router.get("/exams/:id", allowRoles("teacher", "student"), teacherController.getExamById);
router.put("/exams/:id", allowRoles("teacher"), teacherController.updateExam);
router.delete("/exams/:id", allowRoles("teacher"), teacherController.deleteExam);

// EXAM SETS - Bộ đề thi
router.get("/exams/:examId/sets", allowRoles("teacher"), teacherController.getExamSets);
router.post("/exams/:examId/shuffle", allowRoles("teacher"), teacherController.shuffleExam);
router.get("/exam-sets/:examSetId/questions", allowRoles("teacher"), teacherController.getExamSetQuestions);

// SESSIONS - Ca thi
router.get("/sessions", allowRoles("teacher"), teacherController.listSessions);
router.post("/sessions", allowRoles("teacher"), teacherController.createSession);
router.put("/sessions/:id", allowRoles("teacher"), teacherController.updateSession);
router.delete("/sessions/:id", allowRoles("teacher"), teacherController.deleteSession);

// PROCTORS - Giám thị
router.get("/proctors", allowRoles("teacher"), teacherController.getAvailableProctors);
router.post("/sessions/:sessionId/proctors", allowRoles("teacher"), teacherController.assignProctorsToSession);
router.get("/exam-sessions/:id/results", allowRoles("teacher"), teacherController.getSessionStats);

// Các routes đặc biệt cần logic phức tạp (tạm thời giữ nguyên)
router.post("/exam-sets/:examSetId/chapter-distribution", allowRoles("teacher"), teacherController.saveExamSetChapterDistribution);

router.post("/exams/shuffle", allowRoles("teacher"), teacherController.shuffleExam);

router.get("/available-proctors", allowRoles("teacher"), teacherController.listAvailableProctors);

router.get("/exam-sessions", allowRoles("teacher"), teacherController.listExamSessions);

router.get("/debug/attempts", allowRoles("teacher"), teacherController.listAttemptsDebug);

router.get("/exam-sessions/:sessionId/student/:studentId", allowRoles("teacher"), teacherController.getStudentAttemptInSession);

module.exports = router;
