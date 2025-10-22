const express = require("express");

const pool = require("../db");
const { requireAuth, allowRoles } = require("../middleware/auth");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const router = express.Router();

// Đăng ký tài khoản giáo viên
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
    // Tạo token đăng nhập ngay sau khi đăng ký
    const SECRET = "secret123";
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET, {
      expiresIn: "2h",
    });
    res.status(201).json({ message: "Đăng ký thành công", token, user });
  } catch (err) {
    console.error("Lỗi đăng ký giáo viên:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Đăng nhập giáo viên
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Thiếu thông tin đăng nhập" });
  }
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1 AND role = 'teacher'",
      [email]
    );
    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ message: "Email hoặc mật khẩu không đúng" });
    }
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Email hoặc mật khẩu không đúng" });
    }
    const SECRET = "secret123";
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET, {
      expiresIn: "2h",
    });
    res.json({
      message: "Đăng nhập thành công",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Lỗi đăng nhập giáo viên:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
});
// Lưu phân bổ số câu hỏi theo chương cho 1 exam_set
router.post(
  "/exam-sets/:examSetId/chapter-distribution",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { examSetId } = req.params;
    const { distribution } = req.body; // [{chapter_id, num_questions}, ...]
    if (!Array.isArray(distribution) || distribution.length === 0) {
      return res.status(400).json({ message: "Thiếu dữ liệu phân bổ chương" });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Xóa phân bổ cũ nếu có
      await client.query(
        "DELETE FROM exam_chapter_distribution WHERE exam_set_id = $1",
        [examSetId]
      );
      // Thêm mới
      for (const item of distribution) {
        if (
          !item.chapter_id ||
          !item.num_questions ||
          item.num_questions <= 0
        ) {
          await client.query("ROLLBACK");
          return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
        }
        await client.query(
          `INSERT INTO exam_chapter_distribution (exam_set_id, chapter_id, num_questions)
           VALUES ($1, $2, $3)`,
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
);
//  1. SUBJECTS - Môn học
// Tạo môn học mới
router.post(
  "/subjects",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Thiếu tên môn học" });

    try {
      // Kiểm tra tên môn học đã tồn tại cho giáo viên này chưa
      const exist = await pool.query(
        "SELECT 1 FROM subjects WHERE name = $1 AND teacher_id = $2",
        [name, req.user.id]
      );
      if (exist.rows.length > 0) {
        return res.status(409).json({ message: "Tên môn học đã tồn tại" });
      }
      const result = await pool.query(
        "INSERT INTO subjects (name, teacher_id) VALUES ($1, $2) RETURNING *",
        [name, req.user.id]
      );
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
      res.status(200).json(result.rows);
    } catch (err) {
      console.error("Lỗi lấy môn học:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Cập nhật môn học
// Sửa môn học 
router.put(
  "/subjects/:id",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Thiếu tên môn học" });

    try {
      // Kiểm tra tên trùng (trừ chính nó)
      const exist = await pool.query(
        "SELECT 1 FROM subjects WHERE name = $1 AND teacher_id = $2 AND id <> $3",
        [name, req.user.id, id]
      );
      if (exist.rows.length > 0) {
        return res.status(409).json({ message: "Tên môn học đã tồn tại" });
      }
      const result = await pool.query(
        "UPDATE subjects SET name=$1 WHERE id=$2 AND teacher_id=$3 RETURNING *",
        [name, id, req.user.id]
      );
      if (result.rows.length === 0)
        return res.status(404).json({ message: "Không tìm thấy môn học" });
      res.status(200).json(result.rows[0]);
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
      // 204 No Content
      res.status(204).send();
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
      res.status(200).json(result.rows);
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
    const { name, chapter_number } = req.body;

    if (!name || !chapter_number) {
      return res.status(400).json({ message: "Thiếu tên hoặc số chương" });
    }

    try {
      const result = await pool.query(
        "INSERT INTO chapters (subject_id, name, chapter_number) VALUES ($1, $2, $3) RETURNING *",
        [subjectId, name, chapter_number]
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
    const { name, chapter_number } = req.body;

    try {
      const result = await pool.query(
        "UPDATE chapters SET name=$1, chapter_number=$2 WHERE id=$3 RETURNING *",
        [name, chapter_number, id]
      );
      if (result.rows.length === 0)
        return res.status(404).json({ message: "Không tìm thấy chương" });
      res.status(200).json(result.rows[0]);
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
      res.status(204).send();
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
    const { subject_id, chapter_id, content, answers } = req.body;


    if (
      !subject_id ||
      !chapter_id ||
      !content ||
      !answers ||
      answers.length < 2
    )
      return res
        .status(400)
        .json({ message: "Thiếu dữ liệu câu hỏi hoặc đáp án" });

    // Validation: Phải có ít nhất 1 đáp án đúng
    const hasCorrectAnswer = answers.some(
      (answer) => answer.is_correct === true
    );
    if (!hasCorrectAnswer) {
      return res.status(400).json({
        message: "Phải có ít nhất 1 đáp án đúng",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Tạo câu hỏi
      const questionResult = await client.query(
        `INSERT INTO questions (subject_id, chapter_id, content) VALUES ($1, $2, $3) RETURNING *`,
        [subject_id, chapter_id, content]
      );
      const questionId = questionResult.rows[0].id;

      // Thêm các đáp án
      
      for (let i = 0; i < answers.length; i++) {
        // Tạo label động: A, B, C, D, E, F
        const label = String.fromCharCode(65 + i); // 65 = 'A'.charCodeAt(0)

        await client.query(
          `INSERT INTO answers (question_id, label, content, is_correct) VALUES ($1, $2, $3, $4)`,
          [
            questionId,
            label,
            answers[i].content,
            answers[i].is_correct || false,
          ]
        );
      }

      await client.query("COMMIT");
      res.status(201).json(questionResult.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("❌ Lỗi thêm câu hỏi:", err.message);
      console.error("❌ Stack trace:", err.stack);
      res.status(500).json({ message: "Lỗi server", error: err.message });
    } finally {
      client.release();
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
       LEFT JOIN chapters c ON q.chapter_id = c.id
       WHERE s.teacher_id = $1
       ORDER BY q.id DESC`,
        [req.user.id]
      );

      // Lấy đáp án cho từng câu hỏi
      for (let question of result.rows) {
        const answers = await pool.query(
          `SELECT * FROM answers WHERE question_id = $1 ORDER BY label`,
          [question.id]
        );
        question.answers = answers.rows;
      }

      res.status(200).json(result.rows);
    } catch (err) {
      console.error("Lỗi lấy câu hỏi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Lấy câu hỏi theo môn học với filter chương
router.get(
  "/questions/:subjectId",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { subjectId } = req.params;
    const { chapter_id } = req.query; // ?chapter_id=123 để lọc theo chương

    try {
      let query =
        "SELECT q.*, c.name AS chapter_name FROM questions q LEFT JOIN chapters c ON q.chapter_id = c.id WHERE q.subject_id=$1";
      let params = [subjectId];

      if (chapter_id) {
        query += " AND q.chapter_id=$2";
        params.push(chapter_id);
      }

      query += " ORDER BY q.id ASC";

      const result = await pool.query(query, params);

      // Lấy đáp án cho từng câu hỏi
      for (let question of result.rows) {
        const answers = await pool.query(
          `SELECT * FROM answers WHERE question_id = $1 ORDER BY label`,
          [question.id]
        );
        question.answers = answers.rows;
      }

      res.status(200).json(result.rows);
    } catch (err) {
      console.error("Lỗi lấy câu hỏi theo môn:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Lấy câu hỏi theo chương cụ thể
router.get(
  "/chapters/:chapterId/questions",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const { chapterId } = req.params;

    try {
      const result = await pool.query(
        `SELECT q.*, c.name AS chapter_name, s.name AS subject_name
         FROM questions q 
         JOIN chapters c ON q.chapter_id = c.id
         JOIN subjects s ON q.subject_id = s.id
         WHERE q.chapter_id = $1 AND s.teacher_id = $2
         ORDER BY q.id ASC`,
        [chapterId, req.user.id]
      );

      // Lấy đáp án cho từng câu hỏi
      for (let question of result.rows) {
        const answers = await pool.query(
          `SELECT * FROM answers WHERE question_id = $1 ORDER BY label`,
          [question.id]
        );
        question.answers = answers.rows;
      }

      res.status(200).json(result.rows);
    } catch (err) {
      console.error("Lỗi lấy câu hỏi theo chương:", err.message);
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
    const { chapter_id, content, answers } = req.body;

    // Validation: Nếu có đáp án, phải có ít nhất 1 đáp án đúng
    if (answers && answers.length > 0) {
      const hasCorrectAnswer = answers.some(
        (answer) => answer.is_correct === true
      );
      if (!hasCorrectAnswer) {
        return res.status(400).json({
          message: "Phải có ít nhất 1 đáp án đúng",
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Cập nhật câu hỏi
      const result = await client.query(
        `UPDATE questions SET chapter_id=$1, content=$2 WHERE id=$3 RETURNING *`,
        [chapter_id, content, id]
      );

      if (result.rows.length === 0) {
        throw new Error("Không tìm thấy câu hỏi");
      }

      // Xóa đáp án cũ và thêm đáp án mới
      if (answers && answers.length > 0) {
        await client.query(`DELETE FROM answers WHERE question_id = $1`, [id]);

        for (let i = 0; i < answers.length; i++) {
          // Tạo label động: A, B, C, D, E, F, ...
          const label = String.fromCharCode(65 + i); // 65 = 'A'.charCodeAt(0)
          await client.query(
            `INSERT INTO answers (question_id, label, content, is_correct) VALUES ($1, $2, $3, $4)`,
            [id, label, answers[i].content, answers[i].is_correct || false]
          );
        }
      }

      await client.query("COMMIT");
      res.status(200).json(result.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Lỗi cập nhật câu hỏi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    } finally {
      client.release();
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
      const result = await pool.query(
        "DELETE FROM questions WHERE id=$1 RETURNING *",
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Không tìm thấy câu hỏi" });
      }
      res.status(204).send();
    } catch (err) {
      console.error("Lỗi xóa câu hỏi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

//  4. EXAMS - Đề thi

//  Trộn câu hỏi ngẫu nhiên từ ngân hàng câu hỏi
router.post(
  "/exams/shuffle",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    const {
      subject_id,
      question_count = 10,
      title,
      duration,
      chapter_ratio,
    } = req.body;

    if (!subject_id || !title || !duration) {
      return res.status(400).json({ message: "Thiếu thông tin đề thi" });
    }

    // chapter_ratio: [{ chapter_id, percent }], tổng percent ~ 100
    // Nếu không truyền chapter_ratio thì lấy ngẫu nhiên toàn bộ
    try {
      let selectedQuestions = [];
      let chapterWarnings = [];
      if (Array.isArray(chapter_ratio) && chapter_ratio.length > 0) {
        // Validate từng phần tử phải có chapter_id và percent hợp lệ
        for (const item of chapter_ratio) {
          if (
            !item.chapter_id ||
            typeof item.percent !== "number" ||
            isNaN(item.percent) ||
            item.percent <= 0
          ) {
            return res.status(400).json({
              message:
                "chapter_ratio phải có chapter_id và percent > 0 cho từng chương",
            });
          }
        }
        // Lấy số câu cho từng chương theo tỉ lệ
        for (const item of chapter_ratio) {
          const num = Math.round((item.percent / 100) * question_count);
          if (num > 0) {
            // Đếm tổng số câu hỏi có sẵn của chương này
            const countRes = await pool.query(
              `SELECT COUNT(*) FROM questions WHERE subject_id = $1 AND chapter_id = $2`,
              [subject_id, item.chapter_id]
            );
            const available = parseInt(countRes.rows[0].count, 10);
            if (available < num) {
              chapterWarnings.push({
                chapter_id: item.chapter_id,
                required: num,
                available,
                message: `Chương ${
                  item.chapter_id
                } chỉ có ${available} câu, thiếu ${
                  num - available
                } câu so với yêu cầu.`,
              });
            }
            const qs = await pool.query(
              `SELECT q.id, q.content FROM questions q WHERE q.subject_id = $1 AND q.chapter_id = $2 ORDER BY RANDOM() LIMIT $3`,
              [subject_id, item.chapter_id, num]
            );
            selectedQuestions.push(...qs.rows);
          }
        }
        // Nếu tổng số câu chưa đủ do làm tròn, bổ sung ngẫu nhiên từ các chương còn lại
        if (selectedQuestions.length < question_count) {
          const excludeIds = selectedQuestions.map((q) => q.id);
          const remain = question_count - selectedQuestions.length;
          const qs = await pool.query(
            `SELECT q.id, q.content FROM questions q WHERE q.subject_id = $1 AND NOT (q.id = ANY($2)) ORDER BY RANDOM() LIMIT $3`,
            [subject_id, excludeIds, remain]
          );
          selectedQuestions.push(...qs.rows);
        }
        // Nếu thừa thì cắt bớt
        selectedQuestions = selectedQuestions.slice(0, question_count);
        // Nếu có chương thiếu câu, trả về cảnh báo
        if (chapterWarnings.length > 0) {
          return res.status(400).json({
            message: "Không đủ số câu hỏi theo tỉ lệ chương.",
            chapter_warnings: chapterWarnings,
            questions_selected: selectedQuestions.length,
          });
        }
      } else {
        // Không có tỉ lệ chương, lấy ngẫu nhiên toàn bộ
        const randomQuestions = await pool.query(
          `SELECT q.id, q.content FROM questions q WHERE q.subject_id = $1 ORDER BY RANDOM() LIMIT $2`,
          [subject_id, question_count]
        );
        selectedQuestions = randomQuestions.rows;
      }

      if (selectedQuestions.length < question_count) {
        return res.status(400).json({
          message: `Chỉ tìm thấy ${selectedQuestions.length} câu hỏi, không đủ ${question_count} câu`,
        });
      }

      // Tạo đề thi với câu hỏi đã chọn
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const examRes = await client.query(
          "INSERT INTO exams (subject_id, title, duration) VALUES ($1,$2,$3) RETURNING *",
          [subject_id, title, duration]
        );
        const examId = examRes.rows[0].id;

        // Tạo exam set với code = 1
        const examSetRes = await client.query(
          "INSERT INTO exam_sets (exam_id, code) VALUES ($1, $2) RETURNING *",
          [examId, 1]
        );
        const examSetId = examSetRes.rows[0].id;

        // Thêm câu hỏi vào exam set với thứ tự ngẫu nhiên
        for (let i = 0; i < selectedQuestions.length; i++) {
          await client.query(
            `INSERT INTO exam_set_questions (exam_set_id, question_id, order_index) VALUES ($1,$2,$3)`,
            [examSetId, selectedQuestions[i].id, i + 1]
          );
        }

        await client.query("COMMIT");

        res.status(201).json({
          message: "Tạo đề thi ngẫu nhiên thành công",
          exam: examRes.rows[0],
          exam_set: examSetRes.rows[0],
          questions_added: selectedQuestions.length,
          questions: selectedQuestions,
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

//  Lấy thống kê câu hỏi theo môn học
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

    // Tạo exam set với code = 1
    const examSetRes = await client.query(
      "INSERT INTO exam_sets (exam_id, code) VALUES ($1, $2) RETURNING *",
      [examId, 1]
    );
    const examSetId = examSetRes.rows[0].id;

    if (question_ids && question_ids.length > 0) {
      for (let i = 0; i < question_ids.length; i++) {
        await client.query(
          `INSERT INTO exam_set_questions (exam_set_id, question_id, order_index) VALUES ($1,$2,$3)`,
          [examSetId, question_ids[i], i + 1]
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

      // Lấy exam set đầu tiên của đề thi
      const examSet = await pool.query(
        "SELECT * FROM exam_sets WHERE exam_id=$1 ORDER BY created_at ASC LIMIT 1",
        [req.params.id]
      );

      if (examSet.rows.length > 0) {
        const examSetId = examSet.rows[0].id;

        // Lấy câu hỏi từ exam set
        const qs = await pool.query(
          `SELECT q.*, esq.order_index
           FROM exam_set_questions esq
           JOIN questions q ON q.id = esq.question_id
           WHERE esq.exam_set_id=$1 ORDER BY esq.order_index ASC`,
          [examSetId]
        );

        // Lấy đáp án cho từng câu hỏi
        for (let question of qs.rows) {
          const answers = await pool.query(
            `SELECT * FROM answers WHERE question_id = $1 ORDER BY label`,
            [question.id]
          );
          question.answers = answers.rows;
        }

        exam.rows[0].questions = qs.rows;
      } else {
        exam.rows[0].questions = [];
      }

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

      // Lấy exam set đầu tiên
      const examSet = await client.query(
        "SELECT id FROM exam_sets WHERE exam_id=$1 ORDER BY created_at ASC LIMIT 1",
        [examId]
      );

      if (examSet.rows.length > 0) {
        const examSetId = examSet.rows[0].id;

        // Xóa câu hỏi cũ và thêm câu hỏi mới
        await client.query(
          "DELETE FROM exam_set_questions WHERE exam_set_id=$1",
          [examSetId]
        );

        if (question_ids && question_ids.length > 0) {
          for (let i = 0; i < question_ids.length; i++) {
            await client.query(
              `INSERT INTO exam_set_questions (exam_set_id, question_id, order_index) VALUES ($1,$2,$3)`,
              [examSetId, question_ids[i], i + 1]
            );
          }
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
      // CASCADE sẽ tự động xóa exam_sets và exam_set_questions
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

    // Hàm sinh mã ngẫu nhiên 6 ký tự chữ + số
    function generateAccessCode(length = 6) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let code = "";
      for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    }

    const finalAccessCode =
      access_code && access_code.trim() !== ""
        ? access_code
        : generateAccessCode();

    try {
      const result = await pool.query(
        `INSERT INTO exam_sessions (exam_id, start_at, end_at, access_code)
       VALUES ($1,$2,$3,$4) RETURNING *`,
        [exam_id, start_at, end_at, finalAccessCode]
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
//  Lấy danh sách kết quả các ca thi của giáo viên
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
// Debug endpoint - Kiểm tra tất cả attempts
router.get(
  "/debug/attempts",
  requireAuth,
  allowRoles("teacher"),
  async (req, res) => {
    try {
      const allAttempts = await pool.query(`
        SELECT a.*, u.full_name, es.id as session_id 
        FROM attempts a 
        JOIN users u ON u.id = a.student_id 
        JOIN exam_sessions es ON es.id = a.session_id
        ORDER BY a.id DESC
      `);
      res.json(allAttempts.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
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
      console.log(
        ` Đang tìm attempt với sessionId: ${sessionId}, studentId: ${studentId}`
      );

      // 1. Lấy bài làm
      const attempt = await pool.query(
        `SELECT a.id AS attempt_id, a.score, a.submitted_at, u.full_name AS student_name
       FROM attempts a
       JOIN users u ON u.id = a.student_id
       WHERE a.session_id = $1 AND a.student_id = $2`,
        [sessionId, studentId]
      );


      const attemptId = attempt.rows[0].attempt_id;

      // 2. Lấy danh sách câu hỏi + đáp án
      const questionAnswers = await pool.query(
        `SELECT 
          q.id as question_id,
          q.content as question_content,
          aa.answer_id as chosen_answer_id
        FROM attempt_answers aa
        JOIN questions q ON q.id = aa.question_id
        WHERE aa.attempt_id = $1
        ORDER BY q.id`,
        [attemptId]
      );

      // 3. Lấy tất cả đáp án cho mỗi câu hỏi
      const detailedAnswers = [];
      let correctCount = 0;

      for (let qa of questionAnswers.rows) {
        // Lấy tất cả đáp án của câu hỏi
        const allAnswers = await pool.query(
          `SELECT id, label, content, is_correct FROM answers WHERE question_id = $1 ORDER BY label`,
          [qa.question_id]
        );

        // Tìm đáp án đúng
        const correctAnswer = allAnswers.rows.find((a) => a.is_correct);
        const chosenAnswer = allAnswers.rows.find(
          (a) => a.id === qa.chosen_answer_id
        );

        // Kiểm tra nếu chọn đúng
        if (
          qa.chosen_answer_id &&
          correctAnswer &&
          qa.chosen_answer_id === correctAnswer.id
        ) {
          correctCount++;
        }

        detailedAnswers.push({
          question_content: qa.question_content,
          all_answers: allAnswers.rows,
          chosen_answer_id: qa.chosen_answer_id,
          chosen_answer_label: chosenAnswer ? chosenAnswer.label : null,
          correct_answer_id: correctAnswer ? correctAnswer.id : null,
          correct_answer_label: correctAnswer ? correctAnswer.label : null,
          is_correct:
            qa.chosen_answer_id && correctAnswer
              ? qa.chosen_answer_id === correctAnswer.id
              : false,
        });
      }

      const result = {
        student: attempt.rows[0].student_name,
        score: attempt.rows[0].score,
        submitted_at: attempt.rows[0].submitted_at,
        total_questions: questionAnswers.rows.length,
        correct_answers: correctCount,
        answers: detailedAnswers,
      };

      
      res.json(result);
    } catch (err) {
      console.error("Lỗi lấy chi tiết bài làm:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

module.exports = router;
