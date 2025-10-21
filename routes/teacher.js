const express = require("express");

const pool = require("../db");
const { requireAuth, allowRoles } = require("../middleware/auth");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const router = express.Router();

// 1. AUTH - Đăng nhập và đăng kí
router.post("/auth/register", async (req, res) => {
  const { full_name, email, password } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ message: "Thiếu thông tin" });
  }

  try {
    // Kiểm tra email trùng
    const existing = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Email đã được sử dụng" });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Thêm tài khoản giáo viên
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'teacher')
       RETURNING id, full_name, email, role`,
      [full_name, email, hashedPassword]
    );

    const user = result.rows[0];
    const jwt = require("jsonwebtoken");
    const SECRET = process.env.JWT_SECRET || "secret123";
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET, {
      expiresIn: "2h",
    });

    res
      .status(201)
      .json({ message: "Đăng ký giáo viên thành công", token, user });
  } catch (err) {
    console.error("Lỗi đăng ký giáo viên:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
});
// Đăng nhập
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Tìm user theo email
    const result = await pool.query("SELECT * FROM users WHERE email=$1", [
      email,
    ]);
    const user = result.rows[0];

    // Nếu không tồn tại user
    if (!user) {
      return res.status(401).json({ message: "Email không tồn tại" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Sai mật khẩu" });
    }
    // Tạo token JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "secret123",
      { expiresIn: "2h" }
    );

    // Gửi phản hồi thành công
    res.json({ token });
  } catch (err) {
    console.error("Lỗi đăng nhập:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
});

//  2. SUBJECTS - Môn học

// Tạo môn học mới
router.post(
  "/subjects",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Thiếu tên môn học" });

    try {
      const result = await pool.query(
        "INSERT INTO subjects (name, teacher_id) VALUES ($1, $2) RETURNING *",
        [name, req.user.id]
      );
      // Trả về ID môn học vừa tạo để frontend có thể mở modal thêm chương
      res.status(201).json({ subject: result.rows[0] });
    } catch (err) {
      console.error("Lỗi thêm môn học:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Lấy danh sách môn học
router.get(
  "/subjects",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, name FROM subjects WHERE teacher_id=$1 ORDER BY id ASC",
        [req.user.id]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Lỗi lấy môn học:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Cập nhật môn học
router.put(
  "/subjects/:id",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Thiếu tên môn học" });

    try {
      const result = await pool.query(
        "UPDATE subjects SET name=$1 WHERE id=$2 AND teacher_id=$3 RETURNING *",
        [name, id, req.user.id]
      );
      if (result.rows.length === 0)
        return res.status(404).json({ message: "Không tìm thấy môn học" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Lỗi cập nhật môn học:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Xóa môn học
router.delete(
  "/subjects/:id",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        "DELETE FROM subjects WHERE id=$1 AND teacher_id=$2 RETURNING *",
        [id, req.user.id]
      );
      if (result.rows.length === 0)
        return res.status(404).json({ message: "Không tìm thấy môn học" });
      res.json({ message: "Đã xóa thành công" });
    } catch (err) {
      console.error("Lỗi xóa môn học:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

//  3. CHAPTERS - Chương

// Lấy danh sách chương theo môn học
router.get(
  "/subjects/:subjectId/chapters",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { subjectId } = req.params;

    try {
      const result = await pool.query(
        "SELECT * FROM chapters WHERE subject_id=$1 ORDER BY chapter_number ASC",
        [subjectId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Lỗi lấy danh sách chương:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Tạo chương mới
router.post(
  "/subjects/:subjectId/chapters",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { subjectId } = req.params;
    const { name, chapter_number, description } = req.body;

    if (!name || !chapter_number) {
      return res.status(400).json({ message: "Thiếu tên hoặc số chương" });
    }

    try {
      const result = await pool.query(
        "INSERT INTO chapters (subject_id, name, chapter_number, description) VALUES ($1, $2, $3, $4) RETURNING *",
        [subjectId, name, chapter_number, description]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Lỗi tạo chương:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Cập nhật chương
router.put(
  "/chapters/:id",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { id } = req.params;
    const { name, chapter_number, description } = req.body;

    try {
      const result = await pool.query(
        "UPDATE chapters SET name=$1, chapter_number=$2, description=$3 WHERE id=$4 RETURNING *",
        [name, chapter_number, description, id]
      );
      if (result.rows.length === 0)
        return res.status(404).json({ message: "Không tìm thấy chương" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Lỗi cập nhật chương:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Xóa chương
router.delete(
  "/chapters/:id",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        "DELETE FROM chapters WHERE id=$1 RETURNING *",
        [id]
      );
      if (result.rows.length === 0)
        return res.status(404).json({ message: "Không tìm thấy chương" });
      res.json({ message: "Đã xóa chương thành công" });
    } catch (err) {
      console.error("Lỗi xóa chương:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

//  4. QUESTIONS - Câu hỏi

// Tạo câu hỏi mới
router.post(
  "/questions",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const {
      subject_id,
      chapter_id,
      text,
      choice_a,
      choice_b,
      choice_c,
      choice_d,
      correct_choice,
    } = req.body;
    if (
      !subject_id ||
      !chapter_id ||
      !text ||
      !choice_a ||
      !choice_b ||
      !choice_c ||
      !choice_d ||
      !correct_choice
    )
      return res.status(400).json({ message: "Thiếu dữ liệu câu hỏi" });

    try {
      const result = await pool.query(
        `INSERT INTO questions (subject_id, chapter_id, text, choice_a, choice_b, choice_c, choice_d, correct_choice)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          subject_id,
          chapter_id,
          text,
          choice_a,
          choice_b,
          choice_c,
          choice_d,
          correct_choice,
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Lỗi thêm câu hỏi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Lấy câu hỏi theo giáo viên
router.get(
  "/questions",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT q.*, s.name AS subject_name, c.name AS chapter_name, c.id AS chapter_id
       FROM questions q
       JOIN subjects s ON q.subject_id = s.id
       JOIN chapters c ON q.chapter_id = c.id
       WHERE s.teacher_id = $1
       ORDER BY q.id DESC`,
        [req.user.id]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Lỗi lấy câu hỏi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Lấy câu hỏi theo môn học
router.get(
  "/questions/:subjectId",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM questions WHERE subject_id=$1 ORDER BY id ASC",
        [req.params.subjectId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Lỗi lấy câu hỏi theo môn:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Cập nhật câu hỏi
router.put(
  "/questions/:id",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { id } = req.params;
    const {
      chapter_id,
      text,
      choice_a,
      choice_b,
      choice_c,
      choice_d,
      correct_choice,
    } = req.body;
    try {
      const result = await pool.query(
        `UPDATE questions
       SET chapter_id=$1, text=$2, choice_a=$3, choice_b=$4, choice_c=$5, choice_d=$6, correct_choice=$7
       WHERE id=$8 RETURNING *`,
        [
          chapter_id,
          text,
          choice_a,
          choice_b,
          choice_c,
          choice_d,
          correct_choice,
          id,
        ]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Lỗi cập nhật câu hỏi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Xóa câu hỏi
router.delete(
  "/questions/:id",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    try {
      await pool.query("DELETE FROM questions WHERE id=$1", [req.params.id]);
      res.json({ message: "Đã xóa câu hỏi" });
    } catch (err) {
      console.error("Lỗi xóa câu hỏi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

//  4. EXAMS - Đề thi

// 🎲 Trộn câu hỏi ngẫu nhiên từ ngân hàng câu hỏi
router.post(
  "/exams/shuffle",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { subject_id, question_count = 10, title, duration } = req.body;

    if (!subject_id || !title || !duration) {
      return res.status(400).json({ message: "Thiếu thông tin đề thi" });
    }

    try {
      // Lấy câu hỏi ngẫu nhiên từ môn học
      const randomQuestions = await pool.query(
        `
      SELECT q.id, q.text, q.choice_a, q.choice_b, q.choice_c, q.choice_d, q.correct_choice
      FROM questions q 
      WHERE q.subject_id = $1
      ORDER BY RANDOM()
      LIMIT $2
    `,
        [subject_id, question_count]
      );

      if (randomQuestions.rows.length < question_count) {
        return res.status(400).json({
          message: `Chỉ tìm thấy ${randomQuestions.rows.length} câu hỏi, không đủ ${question_count} câu`,
        });
      }

      // Tạo đề thi với câu hỏi đã trộn
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const examRes = await client.query(
          "INSERT INTO exams (subject_id, title, duration) VALUES ($1,$2,$3) RETURNING *",
          [subject_id, title, duration]
        );
        const examId = examRes.rows[0].id;

        // Thêm câu hỏi vào đề thi với thứ tự ngẫu nhiên
        for (let i = 0; i < randomQuestions.rows.length; i++) {
          await client.query(
            `INSERT INTO exam_questions (exam_id, question_id, order_index)
           VALUES ($1,$2,$3)`,
            [examId, randomQuestions.rows[i].id, i + 1]
          );
        }

        await client.query("COMMIT");

        res.status(201).json({
          message: "Tạo đề thi ngẫu nhiên thành công",
          exam: examRes.rows[0],
          questions_added: randomQuestions.rows.length,
          questions: randomQuestions.rows,
        });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("Lỗi tạo đề thi ngẫu nhiên:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// 📊 Lấy thống kê câu hỏi theo môn học
router.get(
  "/subjects/:subjectId/question-stats",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { subjectId } = req.params;

    try {
      const stats = await pool.query(
        `
      SELECT 
        COUNT(q.id) as question_count
      FROM questions q
      WHERE q.subject_id = $1
    `,
        [subjectId]
      );

      res.json({
        summary: { total_questions: stats.rows[0].question_count },
        by_subject: stats.rows,
      });
    } catch (err) {
      console.error("Lỗi lấy thống kê câu hỏi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Lấy danh sách đề thi
router.get("/exams", requireAuth, allowRoles("teacher"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, s.name AS subject_name
       FROM exams e
       JOIN subjects s ON e.subject_id = s.id
       WHERE s.teacher_id = $1
       ORDER BY e.id DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Lỗi lấy danh sách đề thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Tạo đề thi + gán câu hỏi
router.post("/exams", requireAuth, allowRoles("teacher"), async (req, res) => {
  const { subject_id, title, duration, question_ids } = req.body;
  if (!subject_id || !title || !duration)
    return res.status(400).json({ message: "Thiếu dữ liệu đề thi" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const examRes = await client.query(
      "INSERT INTO exams (subject_id, title, duration) VALUES ($1,$2,$3) RETURNING *",
      [subject_id, title, duration]
    );
    const examId = examRes.rows[0].id;

    if (question_ids && question_ids.length > 0) {
      for (let i = 0; i < question_ids.length; i++) {
        await client.query(
          `INSERT INTO exam_questions (exam_id, question_id, order_index)
           VALUES ($1,$2,$3)`,
          [examId, question_ids[i], i + 1]
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json(examRes.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Lỗi tạo đề thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  } finally {
    client.release();
  }
});

// Lấy đề thi + câu hỏi
router.get(
  "/exams/:id",
  requireAuth,
  allowRoles("teacher", "student"),
  async (req, res) => {
    try {
      const exam = await pool.query("SELECT * FROM exams WHERE id=$1", [
        req.params.id,
      ]);
      if (exam.rows.length === 0)
        return res.status(404).json({ message: "Không có đề thi" });

      const qs = await pool.query(
        `SELECT q.*, eq.order_index
       FROM exam_questions eq
       JOIN questions q ON q.id = eq.question_id
       WHERE eq.exam_id=$1 ORDER BY eq.order_index ASC`,
        [req.params.id]
      );

      exam.rows[0].questions = qs.rows;
      res.json(exam.rows[0]);
    } catch (err) {
      console.error("Lỗi lấy đề thi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);
// Cập nhật đề thi + câu hỏi
router.put(
  "/exams/:id",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { title, duration, question_ids } = req.body;
    const examId = req.params.id;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE exams SET title=$1, duration=$2 WHERE id=$3", [
        title,
        duration,
        examId,
      ]);

      await client.query("DELETE FROM exam_questions WHERE exam_id=$1", [
        examId,
      ]);
      if (question_ids && question_ids.length > 0) {
        for (let i = 0; i < question_ids.length; i++) {
          await client.query(
            `INSERT INTO exam_questions (exam_id, question_id, order_index)
           VALUES ($1,$2,$3)`,
            [examId, question_ids[i], i + 1]
          );
        }
      }

      await client.query("COMMIT");
      res.json({ message: "Đã cập nhật đề thi" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Lỗi cập nhật đề thi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    } finally {
      client.release();
    }
  }
);

// Xóa đề thi
router.delete(
  "/exams/:id",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    try {
      await pool.query("DELETE FROM exam_questions WHERE exam_id=$1", [
        req.params.id,
      ]);
      await pool.query("DELETE FROM exams WHERE id=$1", [req.params.id]);
      res.json({ message: "Đã xóa đề thi" });
    } catch (err) {
      console.error("Lỗi xóa đề thi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

//  5. EXAM SESSIONS - Ca thi

// Tạo ca thi
router.post(
  "/sessions",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { exam_id, start_at, end_at, access_code } = req.body;
    if (!exam_id || !start_at || !end_at)
      return res.status(400).json({ message: "Thiếu dữ liệu ca thi" });

    try {
      const result = await pool.query(
        `INSERT INTO exam_sessions (exam_id, start_at, end_at, access_code)
       VALUES ($1,$2,$3,$4) RETURNING *`,
        [exam_id, start_at, end_at, access_code || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Lỗi tạo ca thi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);
router.put(
  "/sessions/:id",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { exam_id, start_at, end_at, access_code } = req.body;
    const sessionId = req.params.id;
    if (!exam_id || !start_at || !end_at)
      return res.status(400).json({ message: "Thiếu dữ liệu ca thi" });
    try {
      const result = await pool.query(
        `UPDATE exam_sessions SET exam_id=$1, start_at=$2, end_at=$3, access_code=$4 WHERE id=$5`,
        [exam_id, start_at, end_at, access_code || null, sessionId]
      );
      res.json({ message: "Đã cập nhật ca thi" });
    } catch (err) {
      console.error("Lỗi cập nhật ca thi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);
router.delete(
  "/sessions/:id",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const sessionId = req.params.id;
    try {
      await pool.query("DELETE FROM exam_sessions WHERE id=$1", [sessionId]);
      res.json({ message: "Đã xóa ca thi" });
    } catch (err) {
      console.error("Lỗi xóa ca thi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Lấy danh sách ca thi
router.get(
  "/sessions",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT se.*, e.title AS exam_title, s.name AS subject_name
       FROM exam_sessions se
       JOIN exams e ON se.exam_id = e.id
       JOIN subjects s ON e.subject_id = s.id
       WHERE s.teacher_id=$1
       ORDER BY se.id DESC`,
        [req.user.id]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Lỗi lấy danh sách ca thi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

//  6. RESULTS - Kết quả ca thi
// 📊 Lấy danh sách kết quả các ca thi của giáo viên
router.get(
  "/exam-sessions",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
      SELECT 
        se.id AS session_id,
        e.title AS exam_title,
        s.name AS subject_name,
        se.start_at,
        se.end_at,
        COUNT(a.id) AS total_students,
        COALESCE(AVG(a.score), 0)::numeric(4,2) AS avg_score
      FROM exam_sessions se
      JOIN exams e ON se.exam_id = e.id
      JOIN subjects s ON e.subject_id = s.id
      LEFT JOIN attempts a ON a.session_id = se.id
      WHERE s.teacher_id = $1
      GROUP BY se.id, e.title, s.name
      ORDER BY se.id DESC
    `,
        [req.user.id]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("Lỗi lấy kết quả thi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

router.get(
  "/exam-sessions/:id/results",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const sessionId = req.params.id;
    try {
      const attempts = await pool.query(
        `SELECT a.id AS attempt_id, a.student_id, u.full_name AS student_name, a.score, a.submitted_at
       FROM attempts a
       JOIN users u ON u.id = a.student_id
       WHERE a.session_id=$1`,
        [sessionId]
      );
      if (attempts.rows.length === 0)
        return res.status(404).json({ message: "Chưa có sinh viên nộp bài" });

      const scores = attempts.rows.map((a) => a.score || 0);
      const avg = (scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(
        2
      );
      res.json({
        session_id: sessionId,
        total_students: scores.length,
        average_score: avg,
        max_score: Math.max(...scores),
        min_score: Math.min(...scores),
        attempts: attempts.rows,
      });
    } catch (err) {
      console.error("Lỗi lấy kết quả ca thi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);
// Xem chi tiết bài làm của 1 sinh viên trong ca thi
router.get(
  "/exam-sessions/:sessionId/student/:studentId",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { sessionId, studentId } = req.params;

    try {
      // 1. Lấy bài làm
      const attempt = await pool.query(
        `SELECT a.id AS attempt_id, a.score, a.submitted_at, u.full_name AS student_name
       FROM attempts a
       JOIN users u ON u.id = a.student_id
       WHERE a.session_id = $1 AND a.student_id = $2`,
        [sessionId, studentId]
      );

      if (attempt.rows.length === 0)
        return res.status(404).json({ message: "Không tìm thấy bài làm" });

      const attemptId = attempt.rows[0].attempt_id;

      // 2. Lấy danh sách câu hỏi + đáp án
      const answers = await pool.query(
        `SELECT q.text, q.choice_a, q.choice_b, q.choice_c, q.choice_d, q.correct_choice, aa.chosen_choice
       FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id
       WHERE aa.attempt_id = $1`,
        [attemptId]
      );

      // 3. Tính số câu đúng
      const total = answers.rows.length;
      const correct = answers.rows.filter(
        (a) => a.chosen_choice === a.correct_choice
      ).length;

      res.json({
        student: attempt.rows[0].student_name,
        score: attempt.rows[0].score,
        submitted_at: attempt.rows[0].submitted_at,
        total_questions: total,
        correct_answers: correct,
        answers: answers.rows,
      });
    } catch (err) {
      console.error("Lỗi lấy chi tiết bài làm:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

module.exports = router;
