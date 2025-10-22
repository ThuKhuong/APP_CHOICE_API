
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

  // Điều kiện: kiểm tra thời gian thi
  const now = new Date();
  const startAt = new Date(session.start_at);
  const endAt = new Date(session.end_at);
  if (now < startAt) {
    return res.status(403).json({ message: "Chưa đến giờ làm bài" });
  }
  if (now > endAt) {
    return res.status(403).json({ message: "Ca thi đã kết thúc" });
  }

  // Kiểm tra xem sinh viên đã có attempt(bài thi) chưa
  // const attemptResult = await pool.query(
  //   "SELECT * FROM attempts WHERE session_id=$1 AND student_id=$2",
  //   [session.id, studentId]
  // );

  // let attempt;
  // if (attemptResult.rows.length > 0) {
  //   attempt = attemptResult.rows[0];
  //   // Điều kiện 4: Nếu đã nộp bài thì không cho vào lại
  //   if (attempt.submitted_at) {
  //     return res
  //       .status(403)
  //       .json({ message: "Bạn đã nộp bài, không thể vào lại ca thi này." });
  //   }
  // } else {
  //   // Nếu chưa thì tạo mới
  //   const insertAttempt = await pool.query(
  //     "INSERT INTO attempts (session_id, student_id) VALUES ($1,$2) RETURNING *",
  //     [session.id, studentId]
  //   );
  //   attempt = insertAttempt.rows[0];
  // }

  // Luôn tạo mới attempt cho mỗi lần vào thi
  const insertAttempt = await pool.query(
    "INSERT INTO attempts (session_id, student_id) VALUES ($1,$2) RETURNING *",
    [session.id, studentId]
  );
  const attempt = insertAttempt.rows[0];

  const questionsResult = await pool.query(
    `SELECT q.id, q.content as text, esq.order_index
     FROM exam_sessions es
     JOIN exam_sets eset ON eset.exam_id = es.exam_id
     JOIN exam_set_questions esq ON esq.exam_set_id = eset.id
     JOIN questions q ON q.id = esq.question_id
     WHERE es.id = $1
     ORDER BY esq.order_index ASC`,
    [session.id]
  );

  // Lấy đáp án cho từng câu hỏi
  for (let question of questionsResult.rows) {
    const answers = await pool.query(
      `SELECT id, label, content, is_correct FROM answers WHERE question_id = $1 ORDER BY label`,
      [question.id]
    );

    // Format lại
    question.choice_a =
      answers.rows.find((a) => a.label === "A")?.content || "";
    question.choice_b =
      answers.rows.find((a) => a.label === "B")?.content || "";
    question.choice_c =
      answers.rows.find((a) => a.label === "C")?.content || "";
    question.choice_d =
      answers.rows.find((a) => a.label === "D")?.content || "";
    question.answers = answers.rows; // Thêm mảng answers đầy đủ
  }

  res.json({
    attempt,
    exam: {
      exam_id: session.exam_id,
      questions: questionsResult.rows,
    },
  });
});

// Lưu đáp án của sinh viên
router.post("/answer", requireAuth, allowRoles("student"), async (req, res) => {
  const { attempt_id, question_id, chosen_choice } = req.body;

  if (!attempt_id || !question_id || !chosen_choice) {
    return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
  }

  try {
    // Tìm answer_id từ label
    const answerResult = await pool.query(
      "SELECT id FROM answers WHERE question_id = $1 AND label = $2",
      [question_id, chosen_choice]
    );

    if (answerResult.rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy đáp án" });
    }

    const answerId = answerResult.rows[0].id;

    // Kiểm tra xem đáp án này đã được chọn chưa
    const existingAnswer = await pool.query(
      "SELECT id FROM attempt_answers WHERE attempt_id = $1 AND question_id = $2 AND answer_id = $3",
      [attempt_id, question_id, answerId]
    );

    if (existingAnswer.rows.length === 0) {
      // Chỉ lưu nếu chưa có (cho phép nhiều đáp án)
      await pool.query(
        "INSERT INTO attempt_answers (attempt_id, question_id, answer_id) VALUES ($1, $2, $3)",
        [attempt_id, question_id, answerId]
      );
    }

    res.json({ message: "Lưu đáp án thành công" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// Bỏ chọn đáp án
router.delete(
  "/answer",
  requireAuth,
  allowRoles("student"),
  async (req, res) => {
    const { attempt_id, question_id, chosen_choice } = req.body;

    if (!attempt_id || !question_id || !chosen_choice) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
    }

    try {
      // Tìm answer_id từ label
      const answerResult = await pool.query(
        "SELECT id FROM answers WHERE question_id = $1 AND label = $2",
        [question_id, chosen_choice]
      );

      if (answerResult.rows.length === 0) {
        return res.status(404).json({ message: "Không tìm thấy đáp án" });
      }

      const answerId = answerResult.rows[0].id;

      // Xóa đáp án đã chọn
      await pool.query(
        "DELETE FROM attempt_answers WHERE attempt_id = $1 AND question_id = $2 AND answer_id = $3",
        [attempt_id, question_id, answerId]
      );

      res.json({ message: "Bỏ chọn đáp án thành công" });
    } catch (err) {
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Nop bai thi
router.post("/submit", requireAuth, allowRoles("student"), async (req, res) => {
  const { attempt_id } = req.body;

  if (!attempt_id) {
    return res.status(400).json({ message: "Thiếu attempt_id" });
  }
  try {
    // 1. Lấy tất cả câu hỏi trong exam (không chỉ những câu đã trả lời)
    const attemptInfo = await pool.query(
      "SELECT session_id FROM attempts WHERE id = $1",
      [attempt_id]
    );
    const sessionId = attemptInfo.rows[0].session_id;

    const questionsRes = await pool.query(
      `SELECT q.id as question_id 
       FROM exam_sessions es
       JOIN exam_sets eset ON eset.exam_id = es.exam_id
       JOIN exam_set_questions esq ON esq.exam_set_id = eset.id
       JOIN questions q ON q.id = esq.question_id
       WHERE es.id = $1
       ORDER BY esq.order_index ASC`,
      [sessionId]
    );
    const questionIds = questionsRes.rows.map((q) => q.question_id);

    let totalScore = 0;
    let totalQuestions = questionIds.length;
    let correctQuestions = 0;

    for (const qid of questionIds) {
      // Đáp án đúng cho câu hỏi này
      const correctAnsRes = await pool.query(
        `SELECT id FROM answers WHERE question_id = $1 AND is_correct = true`,
        [qid]
      );
      const correctAnsIds = correctAnsRes.rows.map((r) => r.id);

      // Đáp án sinh viên đã chọn (có thể nhiều đáp án cho multiple correct)
      const chosenAnsRes = await pool.query(
        `SELECT answer_id FROM attempt_answers WHERE attempt_id = $1 AND question_id = $2`,
        [attempt_id, qid]
      );
      const chosenAnsIds = chosenAnsRes.rows.map((r) => r.answer_id);

      // Số đáp án đúng được chọn
      const numCorrectChosen = chosenAnsIds.filter((id) =>
        correctAnsIds.includes(id)
      ).length;
      // Số đáp án sai bị chọn
      const numWrongChosen = chosenAnsIds.filter(
        (id) => !correctAnsIds.includes(id)
      ).length;
      // Số đáp án đúng tổng cộng
      const numCorrect = correctAnsIds.length;
      // (số đúng chọn - số sai chọn)/tổng số đáp án đúng
      let qScore = (numCorrectChosen - numWrongChosen) / (numCorrect || 1);
      if (qScore < 0) qScore = 0;
      if (numCorrect > 0) totalScore += qScore;
      // Nếu chọn đúng ít nhất 1 đáp án đúng, không chọn sai, tính là đúng hoàn toàn
      if (numCorrectChosen > 0 && numWrongChosen === 0) {
        correctQuestions++;
      } else {
        // Không tính câu hỏi này là đúng
      }
    }

    // Thang điểm 10
    const score = totalQuestions > 0 ? (totalScore / totalQuestions) * 10 : 0;

    await pool.query(
      `UPDATE attempts
     SET score = $1, submitted_at = NOW()
     WHERE id = $2`,
      [score, attempt_id]
    );

    res.json({ attempt_id, score, correctQuestions, totalQuestions });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
// sinh vien muon xem lai diem va dap an
router.get(
  "/attempts/:id",
  requireAuth,
  allowRoles("student"),
  async (req, res) => {
    const attemptId = req.params.id;

    try {
      const attempt = await pool.query("SELECT * FROM attempts WHERE id = $1", [
        attemptId,
      ]);
      if (attempt.rows.length === 0) {
        return res.status(404).json({ message: "Không tìm thấy bài thi" });
      }
      const answers = await pool.query(
        `SELECT q.id, q.content as text, aa.answer_id, chosen_ans.label as chosen_choice
     FROM attempt_answers aa
     JOIN questions q ON q.id = aa.question_id
     JOIN answers chosen_ans ON chosen_ans.id = aa.answer_id
     WHERE aa.attempt_id=$1`,
        [attemptId]
      );

      // Lấy tất cả đáp án cho mỗi câu hỏi để hiển thị đầy đủ
      for (let answer of answers.rows) {
        const allAnswers = await pool.query(
          `SELECT label, content, is_correct FROM answers WHERE question_id = $1 ORDER BY label`,
          [answer.id]
        );

        // Format lại
        answer.choice_a =
          allAnswers.rows.find((a) => a.label === "A")?.content || "";
        answer.choice_b =
          allAnswers.rows.find((a) => a.label === "B")?.content || "";
        answer.choice_c =
          allAnswers.rows.find((a) => a.label === "C")?.content || "";
        answer.choice_d =
          allAnswers.rows.find((a) => a.label === "D")?.content || "";
        answer.correct_choice =
          allAnswers.rows.find((a) => a.is_correct)?.label || "";
      }

      res.json({
        attempt: attempt.rows[0],
        answers: answers.rows,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

// API lấy lịch sử thi của sinh viên cái này làm  gì thì tự làm nhé bé tlinh
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
    res.status(500).json({ message: "Lỗi server" });
  }
});

module.exports = router;
