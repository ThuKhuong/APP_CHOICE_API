const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Subject = require("../models/Subject");
const Question = require("../models/Question");
const Exam = require("../models/Exam");
const ExamSet = require("../models/ExamSet");
const Session = require("../models/Session");
const pool = require("../db");

const SECRET = process.env.JWT_SECRET || "secret123";

async function registerTeacher(req, res) {
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
}

async function listSubjects(req, res) {
  try {
    const subjects = await Subject.listSubjectsByTeacher(req.user.id);
    res.status(200).json(subjects);
  } catch (err) {
    console.error("Lỗi lấy môn học:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function createSubject(req, res) {
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
}

async function updateSubjectById(req, res) {
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
}

async function deleteSubjectById(req, res) {
  const { id } = req.params;
  try {
    const deleted = await Subject.deleteSubject({ id, teacher_id: req.user.id });
    if (!deleted) return res.status(404).json({ message: "Không tìm thấy môn học" });
    res.status(204).send();
  } catch (err) {
    console.error("Lỗi xóa môn học:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function listChaptersBySubject(req, res) {
  const { subjectId } = req.params;
  try {
    const chapters = await Subject.listChapters(subjectId, req.user.id);
    res.status(200).json(chapters);
  } catch (err) {
    console.error("Lỗi lấy chương:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function createChapterForSubject(req, res) {
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
}

async function updateChapterById(req, res) {
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
}

async function deleteChapterById(req, res) {
  const { id } = req.params;
  try {
    const deleted = await Subject.deleteChapter(id, req.user.id);
    if (!deleted) return res.status(404).json({ message: "Không tìm thấy chương" });
    res.status(204).send();
  } catch (err) {
    console.error("Lỗi xóa chương:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function loginTeacher(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Thiếu thông tin đăng nhập" });
  }
  try {
    const user = await User.findByEmail(email);
    if (!user || user.role !== 'teacher') {
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    }
    const bcrypt = require("bcrypt");
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
}

// Questions
async function createQuestion(req, res) {
  const { subject_id, chapter_id, content, answers } = req.body;
  
  if (!subject_id || !chapter_id || !content || !answers || answers.length < 2) {
    return res.status(400).json({ message: "Thiếu dữ liệu câu hỏi hoặc đáp án" });
  }

  const hasCorrectAnswer = answers.some(answer => answer.is_correct === true);
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
}

async function listQuestions(req, res) {
  try {
    const questions = await Question.listQuestionsByTeacher(req.user.id);
    res.status(200).json(questions);
  } catch (err) {
    console.error("Lỗi lấy câu hỏi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function getQuestionsBySubject(req, res) {
  const { subjectId } = req.params;
  try {
    const questions = await Question.getQuestionsBySubject(subjectId, req.user.id);
    res.status(200).json(questions);
  } catch (err) {
    console.error("Lỗi lấy câu hỏi theo môn:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function getQuestionsByChapter(req, res) {
  const { chapterId } = req.params;
  try {
    const questions = await Question.getQuestionsByChapter(chapterId, req.user.id);
    res.status(200).json(questions);
  } catch (err) {
    console.error("Lỗi lấy câu hỏi theo chương:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function updateQuestion(req, res) {
  const { id } = req.params;
  const { content, answers } = req.body;
  
  try {
    await Question.updateQuestion({ question_id: id, teacher_id: req.user.id, content, answers });
    res.status(200).json({ message: "Cập nhật câu hỏi thành công" });
  } catch (err) {
    console.error("Lỗi cập nhật câu hỏi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function deleteQuestion(req, res) {
  const { id } = req.params;
  try {
    const deleted = await Question.deleteQuestion(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy câu hỏi" });
    }
    res.status(204).send();
  } catch (err) {
    console.error("Lỗi xóa câu hỏi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function getQuestionStats(req, res) {
  const { subjectId } = req.params;
  try {
    const stats = await Question.getQuestionStats(subjectId, req.user.id);
    res.status(200).json(stats);
  } catch (err) {
    console.error("Lỗi lấy thống kê câu hỏi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Exams
async function listExams(req, res) {
  try {
    const exams = await Exam.listExamsByTeacher(req.user.id);
    res.status(200).json(exams);
  } catch (err) {
    console.error("Lỗi lấy đề thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function createExam(req, res) {
  const { subject_id, title, duration, question_ids, questions } = req.body;
  
  if (!subject_id || !title || !duration) {
    return res.status(400).json({ message: "Thiếu thông tin đề thi" });
  }

  try {
    const exam = await Exam.createExam({ subject_id, title, duration, teacher_id: req.user.id });
    
    // Nếu có danh sách câu hỏi từ preview
    if (questions && questions.length > 0) {
      const questionIds = questions.map(q => q.id);
      await Exam.assignQuestionsToExam(exam.id, questionIds);
    }
    // Nếu có danh sách ID câu hỏi (cách cũ)
    else if (question_ids && question_ids.length > 0) {
      await Exam.assignQuestionsToExam(exam.id, question_ids);
    }
    
    res.status(201).json(exam);
  } catch (err) {
    console.error("Lỗi tạo đề thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function generateExamPreview(req, res) {
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
}

async function getExamById(req, res) {
  const { id } = req.params;
  try {
    const exam = await Exam.getExamById(id, req.user.id);
    if (!exam) {
      return res.status(404).json({ message: "Không tìm thấy đề thi" });
    }
    res.status(200).json(exam);
  } catch (err) {
    console.error("Lỗi lấy đề thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function updateExam(req, res) {
  const { id } = req.params;
  const { title, duration, question_ids } = req.body;
  
  try {
    const updated = await Exam.updateExam({ exam_id: id, teacher_id: req.user.id, title, duration });
    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy đề thi" });
    }
    
    if (question_ids && question_ids.length > 0) {
      await Exam.assignQuestionsToExam(id, question_ids);
    }
    
    res.status(200).json(updated);
  } catch (err) {
    console.error("Lỗi cập nhật đề thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function deleteExam(req, res) {
  const { id } = req.params;
  try {
    const deleted = await Exam.deleteExam(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy đề thi" });
    }
    res.status(204).send();
  } catch (err) {
    console.error("Lỗi xóa đề thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Sessions
async function listSessions(req, res) {
  try {
    const sessions = await Session.listSessionsByTeacher(req.user.id);
    res.status(200).json(sessions);
  } catch (err) {
    console.error("Lỗi lấy ca thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function createSession(req, res) {
  const { exam_id, start_at, end_at, access_code, proctor_id } = req.body;
  
  if (!exam_id || !start_at || !end_at || !access_code) {
    return res.status(400).json({ message: "Thiếu thông tin ca thi" });
  }

  try {
    const session = await Session.createSession({ exam_id, start_at, end_at, access_code, proctor_id, teacher_id: req.user.id });
    if (!session) {
      return res.status(404).json({ message: "Không tìm thấy đề thi" });
    }
    res.status(201).json(session);
  } catch (err) {
    console.error("Lỗi tạo ca thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function updateSession(req, res) {
  const { id } = req.params;
  const { start_at, end_at, access_code } = req.body;
  
  try {
    const updated = await Session.updateSession({ session_id: id, teacher_id: req.user.id, start_at, end_at, access_code });
    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy ca thi" });
    }
    res.status(200).json(updated);
  } catch (err) {
    console.error("Lỗi cập nhật ca thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function deleteSession(req, res) {
  const { id } = req.params;
  try {
    const deleted = await Session.deleteSession(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy ca thi" });
    }
    res.status(204).send();
  } catch (err) {
    console.error("Lỗi xóa ca thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function getSessionStats(req, res) {
  const { id } = req.params;
  try {
    const stats = await Session.getSessionStats(id, req.user.id);
    if (!stats) {
      return res.status(404).json({ message: "Không tìm thấy ca thi" });
    }
    res.status(200).json(stats);
  } catch (err) {
    console.error("Lỗi lấy thống kê ca thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

// Special endpoints that were previously inline in routes
async function saveExamSetChapterDistribution(req, res) {
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
}

async function shuffleExam(req, res) {
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
}

async function listAvailableProctors(req, res) {
  try {
    const result = await pool.query(
      "SELECT id, full_name, email FROM users WHERE role IN ('teacher', 'proctor') ORDER BY full_name"
    );
    res.json({ proctors: result.rows });
  } catch (err) {
    console.error("Lỗi lấy danh sách giám thị:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function listExamSessions(req, res) {
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
}

async function listAttemptsDebug(req, res) {
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
}

async function getStudentAttemptInSession(req, res) {
  const { sessionId, studentId } = req.params;
  try {
    const result = await pool.query(
      `SELECT a.*, u.full_name, e.title as exam_title
       FROM attempts a
       JOIN users u ON a.student_id = u.id
       JOIN exam_sessions se ON a.session_id = se.id
       JOIN exams e ON se.exam_id = e.id
       JOIN subjects s ON e.subject_id = s.id
       WHERE a.session_id = $1 AND a.student_id = $2 AND s.teacher_id = $3`,
      [sessionId, studentId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy bài làm" });
    }
    res.json({ attempt: result.rows[0] });
  } catch (err) {
    console.error("Lỗi lấy chi tiết bài làm:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function getQuestionsByChapterForReplacement(req, res) {
  const { chapterId } = req.params;
  
  try {
    const questions = await Question.getQuestionsByChapter(chapterId, req.user.id);
    res.status(200).json(questions);
  } catch (err) {
    console.error("Lỗi lấy câu hỏi theo chương:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function getAvailableProctors(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, status
       FROM users 
       WHERE role = 'proctor' AND status = 1
       ORDER BY full_name`,
      []
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Lỗi lấy danh sách giám thị:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function assignProctorsToSession(req, res) {
  const { sessionId } = req.params;
  const { proctorIds } = req.body;
  
  try {
    const client = await pool.connect();
    await client.query("BEGIN");
    
    // Xóa phân công cũ
    await client.query("DELETE FROM proctor_assignments WHERE session_id = $1", [sessionId]);
    
    // Thêm phân công mới
    for (const proctorId of proctorIds) {
      await client.query(
        "INSERT INTO proctor_assignments (session_id, proctor_id) VALUES ($1, $2)",
        [sessionId, proctorId]
      );
    }
    
    await client.query("COMMIT");
    res.status(200).json({ message: "Phân công giám thị thành công" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Lỗi phân công giám thị:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  } finally {
    client.release();
  }
}

async function getExamSets(req, res) {
  const { examId } = req.params;
  
  try {
    const examSets = await ExamSet.getExamSetsByExam(examId);
    res.status(200).json(examSets);
  } catch (err) {
    console.error("Lỗi lấy danh sách bộ đề:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function shuffleExam(req, res) {
  const { examId } = req.params;
  const { count } = req.body;
  
  // Validate input
  if (!count || count < 1 || count > 20) {
    return res.status(400).json({ message: "Số lượng bộ đề phải từ 1 đến 20" });
  }
  
  try {
    // Lấy thông tin đề thi
    const exam = await Exam.getExamById(examId, req.user.id);
    if (!exam) {
      return res.status(404).json({ message: "Không tìm thấy đề thi" });
    }
    
    // Kiểm tra xem có bộ đề gốc chưa
    const hasOriginalSet = await ExamSet.checkOriginalExamSetExists(examId);
    if (!hasOriginalSet) {
      return res.status(400).json({ message: "Đề thi chưa có câu hỏi. Vui lòng tạo đề thi với câu hỏi trước." });
    }
    
    // Lấy câu hỏi từ bộ đề gốc
    const originalQuestions = await ExamSet.getOriginalExamSetQuestions(examId);
    if (originalQuestions.length === 0) {
      return res.status(400).json({ message: "Đề thi chưa có câu hỏi" });
    }
    
    // Tạo các bộ đề mới
    await ExamSet.createShuffledExamSets(examId, count, originalQuestions);
    
    res.status(200).json({ message: `Đã tạo ${count} bộ đề thi thành công` });
  } catch (err) {
    console.error("Lỗi trộn đề thi:", err.message);
    res.status(500).json({ message: "Lỗi server: " + err.message });
  }
}

async function getExamSetQuestions(req, res) {
  const { examSetId } = req.params;
  
  try {
    const questions = await ExamSet.getExamSetQuestions(examSetId);
    
    // Group answers by question
    const questionsWithAnswers = questions.reduce((acc, row) => {
      const questionId = row.id;
      if (!acc[questionId]) {
        acc[questionId] = {
          id: row.id,
          content: row.content,
          chapter_name: row.chapter_name,
          chapter_number: row.chapter_number,
          answers: []
        };
      }
      
      if (row.label) {
        acc[questionId].answers.push({
          label: row.label,
          content: row.answer_content,
          is_correct: row.is_correct
        });
      }
      
      return acc;
    }, {});
    
    const result = Object.values(questionsWithAnswers);
    res.status(200).json(result);
  } catch (err) {
    console.error("Lỗi lấy câu hỏi bộ đề:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

module.exports = {
  registerTeacher,
  loginTeacher,
  listSubjects,
  createSubject,
  updateSubjectById,
  deleteSubjectById,
  listChaptersBySubject,
  createChapterForSubject,
  updateChapterById,
  deleteChapterById,
  createQuestion,
  listQuestions,
  getQuestionsBySubject,
  getQuestionsByChapter,
  updateQuestion,
  deleteQuestion,
  getQuestionStats,
  listExams,
  createExam,
  generateExamPreview,
  getExamById,
  updateExam,
  deleteExam,
  listSessions,
  createSession,
  updateSession,
  deleteSession,
  getSessionStats,
  saveExamSetChapterDistribution,
  shuffleExam,
  listAvailableProctors,
  listExamSessions,
  listAttemptsDebug,
  getStudentAttemptInSession,
  getQuestionsByChapterForReplacement,
  getAvailableProctors,
  assignProctorsToSession,
  getExamSets,
  getExamSetQuestions,
};


