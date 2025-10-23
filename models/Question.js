const pool = require("../db");

async function createQuestion({ subject_id, chapter_id, content, answers, teacher_id }) {
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
      const label = String.fromCharCode(65 + i); // A, B, C, D, E, F
      await client.query(
        `INSERT INTO answers (question_id, label, content, is_correct) VALUES ($1, $2, $3, $4)`,
        [questionId, label, answers[i].content, answers[i].is_correct || false]
      );
    }

    await client.query("COMMIT");
    return questionResult.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listQuestionsByTeacher(teacher_id) {
  const result = await pool.query(
    `SELECT q.*, s.name AS subject_name, c.name AS chapter_name, c.id AS chapter_id
     FROM questions q
     JOIN subjects s ON q.subject_id = s.id
     LEFT JOIN chapters c ON q.chapter_id = c.id
     WHERE s.teacher_id = $1
     ORDER BY q.id DESC`,
    [teacher_id]
  );
  return result.rows;
}

async function getQuestionsBySubject(subject_id, teacher_id) {
  const result = await pool.query(
    `SELECT q.*, c.name AS chapter_name
     FROM questions q
     JOIN subjects s ON q.subject_id = s.id
     LEFT JOIN chapters c ON q.chapter_id = c.id
     WHERE q.subject_id = $1 AND s.teacher_id = $2
     ORDER BY q.id ASC`,
    [subject_id, teacher_id]
  );
  return result.rows;
}

async function getQuestionsByChapter(chapter_id, teacher_id) {
  const result = await pool.query(
    `SELECT q.*, c.name AS chapter_name, s.name AS subject_name
     FROM questions q 
     JOIN chapters c ON q.chapter_id = c.id
     JOIN subjects s ON q.subject_id = s.id
     WHERE q.chapter_id = $1 AND s.teacher_id = $2
     ORDER BY q.id ASC`,
    [chapter_id, teacher_id]
  );
  return result.rows;
}

async function getQuestionById(question_id, teacher_id) {
  const result = await pool.query(
    `SELECT q.*, s.name AS subject_name, c.name AS chapter_name
     FROM questions q
     JOIN subjects s ON q.subject_id = s.id
     LEFT JOIN chapters c ON q.chapter_id = c.id
     WHERE q.id = $1 AND s.teacher_id = $2`,
    [question_id, teacher_id]
  );
  return result.rows[0] || null;
}

async function updateQuestion({ question_id, teacher_id, content, answers }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Cập nhật nội dung câu hỏi
    await client.query(
      "UPDATE questions SET content = $1 WHERE id = $2",
      [content, question_id]
    );

    // Xóa đáp án cũ
    await client.query("DELETE FROM answers WHERE question_id = $1", [question_id]);

    // Thêm đáp án mới
    for (let i = 0; i < answers.length; i++) {
      const label = String.fromCharCode(65 + i);
      await client.query(
        `INSERT INTO answers (question_id, label, content, is_correct) VALUES ($1, $2, $3, $4)`,
        [question_id, label, answers[i].content, answers[i].is_correct || false]
      );
    }

    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function deleteQuestion(question_id, teacher_id) {
  const result = await pool.query(
    `DELETE FROM questions 
     WHERE id = $1 AND subject_id IN (SELECT id FROM subjects WHERE teacher_id = $2)
     RETURNING *`,
    [question_id, teacher_id]
  );
  return result.rows[0] || null;
}

async function getQuestionStats(subject_id, teacher_id) {
  const result = await pool.query(
    `SELECT 
       COUNT(*) as total_questions,
       COUNT(CASE WHEN chapter_id IS NOT NULL THEN 1 END) as questions_with_chapter,
       COUNT(CASE WHEN chapter_id IS NULL THEN 1 END) as questions_without_chapter
     FROM questions q
     JOIN subjects s ON q.subject_id = s.id
     WHERE q.subject_id = $1 AND s.teacher_id = $2`,
    [subject_id, teacher_id]
  );
  return result.rows[0];
}

module.exports = {
  createQuestion,
  listQuestionsByTeacher,
  getQuestionsBySubject,
  getQuestionsByChapter,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  getQuestionStats,
};
