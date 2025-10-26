// controllers/teacherController.js 
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Subject = require("../models/Subject");
const Question = require("../models/Question");
const Exam = require("../models/Exam");
const ExamSet = require("../models/ExamSet");
const Session = require("../models/Session");
const ProctorAssignment = require("../models/ProctorAssignment");
const pool = require("../db");

const SECRET = process.env.JWT_SECRET || "secret123";

// ========== Auth ==========

exports.registerTeacher = async (req, res) => {
  const { full_name, email, password } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ message: "Thiếu thông tin" });
  }
  try {
    const existing = await User.findByEmail(email);
    if (existing) return res.status(400).json({ message: "Email đã được sử dụng" });
    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.createTeacherPending({ full_name, email, password_hash });
    const token = jwt.sign({ id: user.id, role: user.role, status: user.status }, SECRET, { expiresIn: "2h" });
    res.status(201).json({ message: "Đăng ký thành công", token, user });
  } catch (err) {
    console.error("Lỗi đăng ký giáo viên:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.loginTeacher = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Thiếu thông tin đăng nhập" });
  }
  try {
    const user = await User.findByEmail(email);
    if (!user || user.role !== 'teacher') {
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    }
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    }
    const token = jwt.sign({ id: user.id, role: user.role, status: user.status }, SECRET, { expiresIn: "2h" });
    res.json({
      message: "Đăng nhập thành công",
      token,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role, status: user.status },
    });
  } catch (err) {
    console.error("Lỗi đăng nhập giáo viên:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// ========== Subjects & Chapters ==========

exports.listSubjects = async (req, res) => {
  try {
    const subjects = await Subject.listSubjectsByTeacher(req.user.id);
    res.status(200).json(subjects);
  } catch (err) {
    console.error("Lỗi lấy môn học:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.createSubject = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "Thiếu tên môn học" });
  try {
    const exists = await Subject.isSubjectNameExistForTeacher({ name, teacher_id: req.user.id });
    if (exists) return res.status(409).json({ message: "Tên môn học đã tồn tại" });
    const subject = await Subject.createSubject({ name, teacher_id: req.user.id });
    res.status(201).json({ subject });
  } catch (err) {
    console.error("Lỗi thêm môn học:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.updateSubjectById = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "Thiếu tên môn học" });
  try {
    const exists = await Subject.isSubjectNameExistForTeacher({ name, teacher_id: req.user.id, exclude_id: id });
    if (exists) return res.status(409).json({ message: "Tên môn học đã tồn tại" });
    const updated = await Subject.updateSubject({ id, teacher_id: req.user.id, name });
    if (!updated) return res.status(404).json({ message: "Không tìm thấy môn học" });
    res.status(200).json(updated);
  } catch (err) {
    console.error("Lỗi cập nhật môn học:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.deleteSubjectById = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Subject.deleteSubject({ id, teacher_id: req.user.id });
    if (!deleted) return res.status(404).json({ message: "Không tìm thấy môn học" });
    res.status(204).send();
  } catch (err) {
    console.error("Lỗi xóa môn học:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.listChaptersBySubject = async (req, res) => {
  const { subjectId } = req.params;
  try {
    const chapters = await Subject.listChapters(subjectId, req.user.id);
    res.status(200).json(chapters);
  } catch (err) {
    console.error("Lỗi lấy chương:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.createChapterForSubject = async (req, res) => {
  const { subjectId } = req.params;
  const { name, chapter_number } = req.body;
  try {
    const created = await Subject.createChapter(subjectId, req.user.id, { name, chapter_number });
    if (!created) return res.status(404).json({ message: "Không tìm thấy môn học" });
    res.status(201).json(created);
  } catch (err) {
    console.error("Lỗi tạo chương:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.updateChapterById = async (req, res) => {
  const { id } = req.params;
  const { name, chapter_number } = req.body;
  try {
    const updated = await Subject.updateChapter(id, req.user.id, { name, chapter_number });
    if (!updated) return res.status(404).json({ message: "Không tìm thấy chương" });
    res.status(200).json(updated);
  } catch (err) {
    console.error("Lỗi cập nhật chương:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.deleteChapterById = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Subject.deleteChapter(id, req.user.id);
    if (!deleted) return res.status(404).json({ message: "Không tìm thấy chương" });
    res.status(204).send();
  } catch (err) {
    console.error("Lỗi xóa chương:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// ========== Questions ==========

exports.createQuestion = async (req, res) => {
  const { subject_id, chapter_id, content, answers } = req.body;
  if (!subject_id || !chapter_id || !content || !answers || answers.length < 2) {
    return res.status(400).json({ message: "Thiếu dữ liệu câu hỏi hoặc đáp án" });
  }
  const hasCorrectAnswer = answers.some(a => a.is_correct === true);
  if (!hasCorrectAnswer) {
    return res.status(400).json({ message: "Phải có ít nhất 1 đáp án đúng" });
  }
  try {
    const question = await Question.createQuestion({ subject_id, chapter_id, content, answers, teacher_id: req.user.id });
    res.status(201).json(question);
  } catch (err) {
    console.error("Lỗi thêm câu hỏi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.listQuestions = async (req, res) => {
  try {
    const questions = await Question.listQuestionsByTeacher(req.user.id);
    res.status(200).json(questions);
  } catch (err) {
    console.error("Lỗi lấy câu hỏi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getQuestionsBySubject = async (req, res) => {
  const { subjectId } = req.params;
  try {
    const questions = await Question.getQuestionsBySubject(subjectId, req.user.id);
    res.status(200).json(questions);
  } catch (err) {
    console.error("Lỗi lấy câu hỏi theo môn:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getQuestionsByChapter = async (req, res) => {
  const { chapterId } = req.params;
  try {
    const questions = await Question.getQuestionsByChapter(chapterId, req.user.id);
    res.status(200).json(questions);
  } catch (err) {
    console.error("Lỗi lấy câu hỏi theo chương:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.updateQuestion = async (req, res) => {
  const { id } = req.params;
  const { content, answers } = req.body;
  try {
    await Question.updateQuestion({ question_id: id, teacher_id: req.user.id, content, answers });
    res.status(200).json({ message: "Cập nhật câu hỏi thành công" });
  } catch (err) {
    console.error("Lỗi cập nhật câu hỏi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.deleteQuestion = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Question.deleteQuestion(id, req.user.id);
    if (!deleted) return res.status(404).json({ message: "Không tìm thấy câu hỏi" });
    res.status(204).send();
  } catch (err) {
    console.error("Lỗi xóa câu hỏi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getQuestionStats = async (req, res) => {
  const { subjectId } = req.params;
  try {
    const stats = await Question.getQuestionStats(subjectId, req.user.id);
    res.status(200).json(stats);
  } catch (err) {
    console.error("Lỗi lấy thống kê câu hỏi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// ========== Exams ==========

exports.listExams = async (req, res) => {
  try {
    const exams = await Exam.listExamsByTeacher(req.user.id);
    res.status(200).json(exams);
  } catch (err) {
    console.error("Lỗi lấy đề thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.createExam = async (req, res) => {
  const { subject_id, title, duration, question_ids, questions } = req.body;
  if (!subject_id || !title || !duration) {
    return res.status(400).json({ message: "Thiếu thông tin đề thi" });
  }
  try {
    const exam = await Exam.createExam({ subject_id, title, duration, teacher_id: req.user.id });
    if (questions && questions.length > 0) {
      const questionIds = questions.map(q => q.id);
      await Exam.assignQuestionsToExam(exam.id, questionIds);
    } else if (question_ids && question_ids.length > 0) {
      await Exam.assignQuestionsToExam(exam.id, question_ids);
    }
    res.status(201).json(exam);
  } catch (err) {
    console.error("Lỗi tạo đề thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.generateExamPreview = async (req, res) => {
  const { subject_id, total_questions, time_limit, chapter_distribution } = req.body;
  if (!subject_id || !total_questions || !chapter_distribution) {
    return res.status(400).json({ message: "Thiếu thông tin cấu hình đề thi" });
  }
  try {
    const previewQuestions = await Exam.generateExamPreview({
      subject_id,
      total_questions,
      chapter_distribution,
      teacher_id: req.user.id
    });
    res.status(200).json(previewQuestions);
  } catch (err) {
    console.error("Lỗi sinh preview đề thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getExamById = async (req, res) => {
  const { id } = req.params;
  try {
    const exam = await Exam.getExamById(id, req.user.id);
    if (!exam) return res.status(404).json({ message: "Không tìm thấy đề thi" });
    res.status(200).json(exam);
  } catch (err) {
    console.error("Lỗi lấy đề thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.updateExam = async (req, res) => {
  const { id } = req.params;
  const { title, duration, question_ids } = req.body;
  try {
    const updated = await Exam.updateExam({ exam_id: id, teacher_id: req.user.id, title, duration });
    if (!updated) return res.status(404).json({ message: "Không tìm thấy đề thi" });
    if (question_ids && question_ids.length > 0) {
      await Exam.assignQuestionsToExam(id, question_ids);
    }
    res.status(200).json(updated);
  } catch (err) {
    console.error("Lỗi cập nhật đề thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.deleteExam = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Exam.deleteExam(id, req.user.id);
    if (!deleted) return res.status(404).json({ message: "Không tìm thấy đề thi" });
    res.status(204).send();
  } catch (err) {
    console.error("Lỗi xóa đề thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// ========== Sessions ==========

exports.listSessions = async (req, res) => {
  try {
    const sessions = await Session.listSessionsByTeacher(req.user.id);
    res.status(200).json(sessions);
  } catch (err) {
    console.error("Lỗi lấy ca thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.createSession = async (req, res) => {
  const { exam_id, start_at, end_at, access_code } = req.body;
  if (!exam_id || !start_at || !end_at) {
    return res.status(400).json({ message: "Thiếu thông tin bắt buộc: exam_id, start_at, end_at" });
  }
  const finalAccessCode = access_code && access_code.trim() ? access_code.trim() : null;
  try {
    const session = await Session.createSession({
      exam_id, start_at, end_at, access_code: finalAccessCode, teacher_id: req.user.id
    });
    if (!session) return res.status(404).json({ message: "Không tìm thấy đề thi hoặc không có quyền truy cập" });
    res.status(201).json(session);
  } catch (err) {
    console.error("Lỗi tạo ca thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.updateSession = async (req, res) => {
  const { id } = req.params;
  const { exam_id, start_at, end_at, access_code } = req.body;
  if (!exam_id || !start_at || !end_at) {
    return res.status(400).json({ message: "Thiếu thông tin bắt buộc: exam_id, start_at, end_at" });
  }
  try {
    const updated = await Session.updateSession({
      session_id: id, teacher_id: req.user.id, exam_id, start_at, end_at, access_code
    });
    if (!updated) return res.status(404).json({ message: "Không tìm thấy ca thi hoặc không có quyền truy cập" });
    res.status(200).json(updated);
  } catch (err) {
    console.error("Lỗi cập nhật ca thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.deleteSession = async (req, res) => {
  const { id } = req.params;
  try {
    const session = await Session.getSessionById(id, req.user.id);
    if (!session) return res.status(404).json({ message: "Không tìm thấy ca thi hoặc không có quyền truy cập" });

    const now = new Date();
    const startTime = new Date(session.start_at);
    const endTime = new Date(session.end_at);
    if (now >= startTime && now <= endTime) {
      return res.status(409).json({ message: "Không thể xóa ca thi đang diễn ra" });
    }

    const attemptsCheck = await pool.query(
      "SELECT COUNT(*) as count FROM attempts WHERE session_id = $1",
      [id]
    );
    if (Number(attemptsCheck.rows[0].count) > 0) {
      return res.status(409).json({ message: "Không thể xóa ca thi đã có thí sinh tham gia" });
    }

    await Session.deleteSession(id, req.user.id);
    res.status(204).send();
  } catch (err) {
    console.error("Lỗi xóa ca thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getSessionById = async (req, res) => {
  const { id } = req.params;
  try {
    const session = await Session.getSessionById(id, req.user.id);
    if (!session) return res.status(404).json({ message: "Không tìm thấy ca thi hoặc không có quyền truy cập" });
    res.status(200).json(session);
  } catch (err) {
    console.error("Lỗi lấy chi tiết ca thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getSessionProctor = async (req, res) => {
  const { id } = req.params;
  try {
    const session = await Session.getSessionById(id, req.user.id);
    if (!session) return res.status(404).json({ message: "Không tìm thấy ca thi hoặc không có quyền truy cập" });
    const proctor = await Session.getSessionProctor(id);
    res.status(200).json(proctor);
  } catch (err) {
    console.error("Lỗi lấy thông tin giám thị:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.cancelSession = async (req, res) => {
  const { id } = req.params;
  try {
    const cancelled = await Session.cancelSession(id, req.user.id);
    if (!cancelled) return res.status(404).json({ message: "Không tìm thấy ca thi hoặc không có quyền truy cập" });
    res.status(200).json({ message: "Hủy ca thi thành công", session: cancelled });
  } catch (err) {
    console.error("Lỗi hủy ca thi:", err.message);
    if (err.message.includes("đang diễn ra")) {
      res.status(409).json({ message: err.message });
    } else {
      res.status(500).json({ message: "Lỗi server" });
    }
  }
};

exports.updateSessionStatuses = async (_req, res) => {
  try {
    const result = await Session.updateSessionStatuses();
    res.status(200).json({ message: "Cập nhật status thành công", ...result });
  } catch (err) {
    console.error("Lỗi cập nhật status:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getSessionStats = async (req, res) => {
  const { id } = req.params;
  try {
    const stats = await Session.getSessionStats(id, req.user.id);
    if (!stats) return res.status(404).json({ message: "Không tìm thấy ca thi" });
    res.status(200).json(stats);
  } catch (err) {
    console.error("Lỗi lấy thống kê ca thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// ========== Special / Tools ==========

exports.saveExamSetChapterDistribution = async (req, res) => {
  const { examSetId } = req.params;
  const { distribution } = req.body; // [{chapter_id, num_questions}]
  if (!Array.isArray(distribution) || distribution.length === 0) {
    return res.status(400).json({ message: "Thiếu dữ liệu phân bổ chương" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM exam_chapter_distribution WHERE exam_set_id = $1", [examSetId]);
    for (const item of distribution) {
      if (!item.chapter_id || !item.num_questions || item.num_questions <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
      }
      await client.query(
        `INSERT INTO exam_chapter_distribution (exam_set_id, chapter_id, num_questions) VALUES ($1, $2, $3)`,
        [examSetId, item.chapter_id, item.num_questions]
      );
    }
    await client.query("COMMIT");
    res.json({ message: "Lưu phân bổ chương thành công" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Lỗi lưu phân bổ chương:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  } finally {
    client.release();
  }
};

exports.shuffleExam = async (req, res) => {
  const { subject_id, title, duration, num_questions, chapter_distribution } = req.body;
  if (!subject_id || !title || !duration || !num_questions || !chapter_distribution) {
    return res.status(400).json({ message: "Thiếu thông tin đề thi" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const examResult = await client.query(
      "INSERT INTO exams (subject_id, title, duration) VALUES ($1, $2, $3) RETURNING *",
      [subject_id, title, duration]
    );
    const examId = examResult.rows[0].id;
    const examSetResult = await client.query(
      "INSERT INTO exam_sets (exam_id, title) VALUES ($1, $2) RETURNING *",
      [examId, title]
    );
    const examSetId = examSetResult.rows[0].id;

    const selectedQuestions = [];
    for (const dist of chapter_distribution) {
      const questionsResult = await client.query(
        `SELECT q.id FROM questions q 
         WHERE q.subject_id = $1 AND q.chapter_id = $2 
         ORDER BY RANDOM() LIMIT $3`,
        [subject_id, dist.chapter_id, dist.num_questions]
      );
      selectedQuestions.push(...questionsResult.rows.map((q) => q.id));
    }

    for (let i = 0; i < selectedQuestions.length; i++) {
      await client.query(
        "INSERT INTO exam_set_questions (exam_set_id, question_id, order_index) VALUES ($1, $2, $3)",
        [examSetId, selectedQuestions[i], i + 1]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ exam: examResult.rows[0], exam_set: examSetResult.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Lỗi tạo đề thi trộn:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  } finally {
    client.release();
  }
};

exports.listAvailableProctors = async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, full_name, email FROM users WHERE role IN ('teacher', 'proctor') ORDER BY full_name"
    );
    res.json({ proctors: result.rows });
  } catch (err) {
    console.error("Lỗi lấy danh sách giám thị:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.listExamSessions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT se.*, e.title AS exam_title, s.name AS subject_name
       FROM exam_sessions se
       JOIN exams e ON se.exam_id = e.id
       JOIN subjects s ON e.subject_id = s.id
       WHERE s.teacher_id = $1
       ORDER BY se.id DESC`,
      [req.user.id]
    );
    res.json({ sessions: result.rows });
  } catch (err) {
    console.error("Lỗi lấy danh sách ca thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.listAttemptsDebug = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.full_name, e.title as exam_title
       FROM attempts a
       JOIN users u ON a.student_id = u.id
       JOIN exam_sessions se ON a.session_id = se.id
       JOIN exams e ON se.exam_id = e.id
       JOIN subjects s ON e.subject_id = s.id
       WHERE s.teacher_id = $1
       ORDER BY a.id DESC`,
      [req.user.id]
    );
    res.json({ attempts: result.rows });
  } catch (err) {
    console.error("Lỗi lấy attempts:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getStudentAttemptInSession = async (req, res) => {
  const { sessionId, studentId } = req.params;
  try {
    // Lấy thông tin cơ bản của attempt
    const attemptResult = await pool.query(
      `SELECT a.*, u.full_name as student, e.title as exam_title
       FROM attempts a
       JOIN users u ON a.student_id = u.id
       JOIN exam_sessions se ON a.session_id = se.id
       JOIN exams e ON se.exam_id = e.id
       JOIN subjects s ON e.subject_id = s.id
       WHERE a.session_id = $1 AND a.student_id = $2 AND s.teacher_id = $3`,
      [sessionId, studentId, req.user.id]
    );
    
    if (attemptResult.rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy bài làm" });
    }
    
    const attempt = attemptResult.rows[0];
    
    // Lấy chi tiết câu trả lời của sinh viên
    const answersResult = await pool.query(
      `SELECT 
         q.id as question_id,
         q.content as question_content,
         qa.id as answer_id,
         qa.content as answer_content,
         qa.label,
         qa.is_correct,
         sa.chosen_answer_id,
         CASE WHEN sa.chosen_answer_id = qa.id THEN qa.label ELSE NULL END as chosen_answer_label,
         CASE WHEN sa.chosen_answer_id = qa.id THEN qa.is_correct ELSE NULL END as is_correct
       FROM questions q
       JOIN question_answers qa ON q.id = qa.question_id
       LEFT JOIN student_answers sa ON q.id = sa.question_id AND sa.attempt_id = $1
       WHERE q.id IN (
         SELECT DISTINCT q2.id 
         FROM questions q2
         JOIN exam_set_questions esq ON q2.id = esq.question_id
         JOIN exam_sessions es ON esq.exam_set_id = es.exam_set_id
         WHERE es.id = $2
       )
       ORDER BY q.id, qa.id`,
      [attempt.id, sessionId]
    );
    
    // Nhóm câu trả lời theo câu hỏi
    const answersByQuestion = {};
    answersResult.rows.forEach(row => {
      if (!answersByQuestion[row.question_id]) {
        answersByQuestion[row.question_id] = {
          question_content: row.question_content,
          all_answers: [],
          chosen_answer_label: null,
          is_correct: false
        };
      }
      
      answersByQuestion[row.question_id].all_answers.push({
        id: row.answer_id,
        content: row.answer_content,
        label: row.label,
        is_correct: row.is_correct
      });
      
      if (row.chosen_answer_label) {
        answersByQuestion[row.question_id].chosen_answer_label = row.chosen_answer_label;
        answersByQuestion[row.question_id].is_correct = row.is_correct;
      }
    });
    
    // Chuyển đổi thành array
    const answers = Object.values(answersByQuestion);
    
    res.json({
      student: attempt.student,
      score: attempt.score,
      correct_answers: attempt.correct_answers,
      total_questions: attempt.total_questions,
      submitted_at: attempt.submitted_at,
      answers: answers
    });
  } catch (err) {
    console.error("Lỗi lấy chi tiết bài làm:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getQuestionsByChapterForReplacement = async (req, res) => {
  const { chapterId } = req.params;
  try {
    const questions = await Question.getQuestionsByChapter(chapterId, req.user.id);
    res.status(200).json(questions);
  } catch (err) {
    console.error("Lỗi lấy câu hỏi theo chương:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.assignProctorsToSession = async (req, res) => {
  const { sessionId } = req.params;
  const { proctorIds } = req.body;
  if (!proctorIds || proctorIds.length === 0) {
    return res.status(400).json({ message: "Vui lòng chọn ít nhất một giám thị" });
  }
  try {
    const proctorId = proctorIds[0];
    const sessionCheck = await ProctorAssignment.checkSessionOwnership(sessionId, req.user.id);
    if (!sessionCheck) {
      return res.status(403).json({ message: "Bạn không có quyền phân công giám thị cho ca thi này" });
    }
    const proctor = await User.getProctorById(proctorId);
    if (!proctor) {
      return res.status(404).json({ message: "Không tìm thấy giám thị hoặc giám thị không có quyền" });
    }
    const conflicts = await User.checkProctorConflict(proctorId, sessionId);
    if (conflicts.length > 0) {
      return res.status(400).json({
        message: "Giám thị đã được phân công ca thi khác trong cùng thời gian",
        conflict: conflicts[0]
      });
    }
    const session = await ProctorAssignment.assignProctorToSession(sessionId, proctorId);
    res.json({ message: "Phân công giám thị thành công", session, proctor });
  } catch (err) {
    console.error("Lỗi phân công giám thị:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.assignSingleProctor = async (req, res) => {
  const { session_id, proctor_id } = req.body;
  if (!session_id || !proctor_id) {
    return res.status(400).json({ message: "Thiếu thông tin session_id hoặc proctor_id" });
  }
  try {
    const sessionCheck = await ProctorAssignment.checkSessionOwnership(session_id, req.user.id);
    if (!sessionCheck) {
      return res.status(403).json({ message: "Bạn không có quyền phân công giám thị cho ca thi này" });
    }
    const proctor = await User.getProctorById(proctor_id);
    if (!proctor) {
      return res.status(404).json({ message: "Không tìm thấy giám thị hoặc giám thị không có quyền" });
    }
    const conflicts = await User.checkProctorConflict(proctor_id, session_id);
    if (conflicts.length > 0) {
      return res.status(400).json({
        message: "Giám thị đã được phân công ca thi khác trong cùng thời gian",
        conflict: conflicts[0]
      });
    }
    const session = await ProctorAssignment.assignProctorToSession(session_id, proctor_id);
    res.json({ message: "Phân công giám thị thành công", session, proctor });
  } catch (err) {
    console.error("Lỗi phân công giám thị:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getExamSets = async (req, res) => {
  const { examId } = req.params;
  try {
    const examSets = await ExamSet.getExamSetsByExam(examId);
    res.status(200).json(examSets);
  } catch (err) {
    console.error("Lỗi lấy danh sách bộ đề:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getExamSetQuestions = async (req, res) => {
  const { examSetId } = req.params;
  try {
    const rows = await ExamSet.getExamSetQuestions(examSetId);
    const grouped = rows.reduce((acc, row) => {
      const qid = row.id;
      if (!acc[qid]) {
        acc[qid] = {
          id: row.id,
          content: row.content,
          chapter_name: row.chapter_name,
          chapter_number: row.chapter_number,
          answers: []
        };
      }
      if (row.label) {
        acc[qid].answers.push({
          label: row.label,
          content: row.answer_content,
          is_correct: row.is_correct
        });
      }
      return acc;
    }, {});
    res.status(200).json(Object.values(grouped));
  } catch (err) {
    console.error("Lỗi lấy câu hỏi bộ đề:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};
