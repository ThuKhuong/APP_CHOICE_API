const express = require("express");
const pool = require("../db");
const { requireAuth, allowRoles } = require("../middleware/auth");

const router = express.Router();

// Bắt đầu làm bài thi
// student.js
router.post("/start", requireAuth, allowRoles("student"), async (req, res) => {
  const { access_code } = req.body;
  const studentId = req.user.id;

  // Tìm session
  const sessionResult = await pool.query(
    "SELECT * FROM exam_sessions WHERE access_code=$1",
    [access_code]
  );
  if (sessionResult.rows.length === 0) {
    return res.status(404).json({ message: "Không tìm thấy ca thi" });
  }
  const session = sessionResult.rows[0];
// API lấy lịch sử thi của sinh viên
router.get("/history", requireAuth, allowRoles("student"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         a.id AS attempt_id,
         e.title AS exam_name,
         a.score,
         a.submitted_at AS date
       FROM attempts a
       JOIN exam_sessions s ON a.session_id = s.id
       JOIN exams e ON s.exam_id = e.id
       WHERE a.student_id = $1
       ORDER BY a.submitted_at DESC`,
      [req.user.id]
    );
    res.json({ attempts: result.rows });
  } catch (err) {
    console.error("Lỗi lấy lịch sử thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Kiểm tra xem sinh viên đã có attempt chưa
  const attemptResult = await pool.query(
    "SELECT * FROM attempts WHERE session_id=$1 AND student_id=$2",
    [session.id, studentId]
  );

  let attempt;
  if (attemptResult.rows.length > 0) {
    // Nếu có rồi thì lấy luôn
    attempt = attemptResult.rows[0];
  } else {
    // Nếu chưa thì tạo mới
    const insertAttempt = await pool.query(
      "INSERT INTO attempts (session_id, student_id) VALUES ($1,$2) RETURNING *",
      [session.id, studentId]
    );
    attempt = insertAttempt.rows[0];
  }

  // Load câu hỏi của đề thi
  const questionsResult = await pool.query(
    `SELECT q.id, q.text, q.choice_a, q.choice_b, q.choice_c, q.choice_d, eq.order_index,q.correct_choice
     FROM exam_questions eq
     JOIN questions q ON q.id = eq.question_id
     WHERE eq.exam_id=$1
     ORDER BY eq.order_index ASC`,
    [session.exam_id]
  );

  res.json({
    attempt,
    exam: {
      exam_id: session.exam_id,
      questions: questionsResult.rows,
    },
  });
});

// Luu cau tra loi cua sinh vien
router.post("/answer", requireAuth, allowRoles("student"), async (req, res) => {
  const { attempt_id, question_id, chosen_choice } = req.body;

  if (!attempt_id || !question_id || !chosen_choice) {
    return res.status(400).json({ message: "Thiếu thông tin câu trả lời" });
  }

  try {
    const check = await pool.query(
      "SELECT * FROM attempt_answers WHERE attempt_id = $1 AND question_id = $2",
      [attempt_id, question_id]
    );
    let result;
    if (check.rows.length > 0) {
      result = await pool.query(
        `UPDATE attempt_answers
        SET chosen_choice = $1
        WHERE attempt_id = $2 AND question_id = $3
        RETURNING *`,
        [chosen_choice, attempt_id, question_id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO attempt_answers (attempt_id, question_id, chosen_choice)
         VALUES ($1, $2, $3) RETURNING *`,
        [attempt_id, question_id, chosen_choice]
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Lỗi lưu câu trả lời:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});
// Nop bai thi
router.post("/submit", requireAuth, allowRoles("student"), async (req, res) => {
  const { attempt_id } = req.body;
  
  if (!attempt_id) {
    return res.status(400).json({ message: "Thiếu attempt_id" });
  }
  try {
    // Lấy danh sách câu hỏi + đáp án đúng
    const answersResult = await pool.query(
      `SELECT q.id, q.correct_choice, aa.chosen_choice
       FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id
       WHERE aa.attempt_id = $1`,
      [attempt_id]
    );
    let correct = 0;
    answersResult.rows.forEach((row) => {
      if (row.chosen_choice === row.correct_choice) {
        correct++;
      }
    });
    const total = answersResult.rows.length;
    const score = total > 0 ? (correct / total) * 10 : 0; // Chấm điểm thang 10

    await pool.query(
      `UPDATE attempts
     SET score = $1, submitted_at = NOW()
     WHERE id = $2`,
      [score, attempt_id]
    );

    res.json({ attempt_id, score, correct, total });
  } catch (err) {
    console.error("Lỗi nộp bài thi:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});
// sinh vien muon xem lai diem va dap an
router.get("/attempts/:id", requireAuth, allowRoles("student"), async (req, res) => {
 const attemptId = req.params.id;

 try {
  const attempt = await pool.query(
    "SELECT * FROM attempts WHERE id = $1",
    [attemptId]);
  if (attempt.rows.length === 0) {
    return res.status(404).json({ message: "Không tìm thấy bài thi" });
 }
  const answers = await pool.query(
    `SELECT q.text, q.choice_a, q.choice_b, q.choice_c, q.choice_d,
            q.correct_choice, aa.chosen_choice
       FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id
       WHERE aa.attempt_id=$1`,
      [attemptId]
  );

  res.json({
    attempt: attempt.rows[0],
    answers: answers.rows,
  });
} catch (err) {
  console.error("Lỗi xem lại bài thi:", err.message);
  res.status(500).json({ message: "Server error" });
}
});

module.exports = router;
