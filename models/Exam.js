const pool = require("../db");

async function createExam({ subject_id, title, duration, teacher_id }) {
  const result = await pool.query(
    "INSERT INTO exams (subject_id, title, duration) VALUES ($1, $2, $3) RETURNING *",
    [subject_id, title, duration]
  );
  return result.rows[0];
}

async function listExamsByTeacher(teacher_id) {
  const result = await pool.query(
    `SELECT e.*, s.name AS subject_name
     FROM exams e
     JOIN subjects s ON e.subject_id = s.id
     WHERE s.teacher_id = $1
     ORDER BY e.id DESC`,
    [teacher_id]
  );
  return result.rows;
}

async function getExamById(exam_id, teacher_id) {
  const result = await pool.query(
    `SELECT e.*, s.name AS subject_name
     FROM exams e
     JOIN subjects s ON e.subject_id = s.id
     WHERE e.id = $1 AND s.teacher_id = $2`,
    [exam_id, teacher_id]
  );
  return result.rows[0] || null;
}

async function updateExam({ exam_id, teacher_id, title, duration }) {
  const result = await pool.query(
    `UPDATE exams SET title = $1, duration = $2
     WHERE id = $3 AND subject_id IN (SELECT id FROM subjects WHERE teacher_id = $4)
     RETURNING *`,
    [title, duration, exam_id, teacher_id]
  );
  return result.rows[0] || null;
}

async function deleteExam(exam_id, teacher_id) {
  const result = await pool.query(
    `DELETE FROM exams 
     WHERE id = $1 AND subject_id IN (SELECT id FROM subjects WHERE teacher_id = $2)
     RETURNING *`,
    [exam_id, teacher_id]
  );
  return result.rows[0] || null;
}

async function assignQuestionsToExam(exam_id, question_ids) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Xóa câu hỏi cũ
    await client.query("DELETE FROM exam_questions WHERE exam_id = $1", [exam_id]);
    
    // Thêm câu hỏi mới
    for (const question_id of question_ids) {
      await client.query(
        "INSERT INTO exam_questions (exam_id, question_id) VALUES ($1, $2)",
        [exam_id, question_id]
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

module.exports = {
  createExam,
  listExamsByTeacher,
  getExamById,
  updateExam,
  deleteExam,
  assignQuestionsToExam,
};
