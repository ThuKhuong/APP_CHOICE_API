const pool = require("../db");

async function createAttempt({ session_id, student_id }) {
  const result = await pool.query(
    `INSERT INTO attempts (session_id, student_id, status, started_at)
     VALUES ($1, $2, 'in_progress', NOW()) RETURNING *`,
    [session_id, student_id]
  );
  return result.rows[0];
}

async function getAttemptBySessionAndStudent(session_id, student_id) {
  const result = await pool.query(
    "SELECT * FROM attempts WHERE session_id = $1 AND student_id = $2",
    [session_id, student_id]
  );
  return result.rows[0] || null;
}

async function getAttemptById(attempt_id, student_id) {
  const result = await pool.query(
    `SELECT a.*, se.access_code, e.title AS exam_title, s.name AS subject_name
     FROM attempts a
     JOIN exam_sessions se ON a.session_id = se.id
     JOIN exams e ON se.exam_id = e.id
     JOIN subjects s ON e.subject_id = s.id
     WHERE a.id = $1 AND a.student_id = $2`,
    [attempt_id, student_id]
  );
  return result.rows[0] || null;
}

async function submitAttempt(attempt_id, student_id) {
  const result = await pool.query(
    `UPDATE attempts 
     SET status = 'submitted', submitted_at = NOW()
     WHERE id = $1 AND student_id = $2
     RETURNING *`,
    [attempt_id, student_id]
  );
  return result.rows[0] || null;
}

async function saveAnswer({ attempt_id, question_id, chosen_choice, student_id }) {
  // Kiểm tra attempt thuộc về student
  const attemptCheck = await pool.query(
    "SELECT 1 FROM attempts WHERE id = $1 AND student_id = $2",
    [attempt_id, student_id]
  );
  
  if (attemptCheck.rows.length === 0) {
    return null;
  }
  
  const result = await pool.query(
    `INSERT INTO student_answers (attempt_id, question_id, chosen_choice)
     VALUES ($1, $2, $3)
     ON CONFLICT (attempt_id, question_id)
     DO UPDATE SET chosen_choice = $3
     RETURNING *`,
    [attempt_id, question_id, chosen_choice]
  );
  return result.rows[0];
}

async function removeAnswer({ attempt_id, question_id, student_id }) {
  const result = await pool.query(
    `DELETE FROM student_answers 
     WHERE attempt_id = $1 AND question_id = $2
     AND attempt_id IN (SELECT id FROM attempts WHERE student_id = $3)
     RETURNING *`,
    [attempt_id, question_id, student_id]
  );
  return result.rows[0] || null;
}

async function getStudentHistory(student_id) {
  const result = await pool.query(
    `SELECT 
       a.id,
       a.score,
       a.status,
       a.started_at,
       a.submitted_at,
       e.title AS exam_title,
       s.name AS subject_name,
       se.access_code
     FROM attempts a
     JOIN exam_sessions se ON a.session_id = se.id
     JOIN exams e ON se.exam_id = e.id
     JOIN subjects s ON e.subject_id = s.id
     WHERE a.student_id = $1
     ORDER BY a.started_at DESC`,
    [student_id]
  );
  return result.rows;
}

async function getAttemptDetails(attempt_id, student_id) {
  const result = await pool.query(
    `SELECT 
       a.*,
       e.title AS exam_title,
       s.name AS subject_name,
       se.access_code,
       se.start_at,
       se.end_at,
       e.duration
     FROM attempts a
     JOIN exam_sessions se ON a.session_id = se.id
     JOIN exams e ON se.exam_id = e.id
     JOIN subjects s ON e.subject_id = s.id
     WHERE a.id = $1 AND a.student_id = $2`,
    [attempt_id, student_id]
  );
  return result.rows[0] || null;
}

module.exports = {
  createAttempt,
  getAttemptBySessionAndStudent,
  getAttemptById,
  submitAttempt,
  saveAnswer,
  removeAnswer,
  getStudentHistory,
  getAttemptDetails,
};
