const pool = require("../db");

exports.createAttempt = async function({ session_id, student_id }) {
  const result = await pool.query(
    `INSERT INTO attempts (session_id, student_id, status, started_at)
     VALUES ($1, $2, 'in_progress', NOW()) RETURNING *`,
    [session_id, student_id]
  );
  return result.rows[0];
};

exports.getAttemptBySessionAndStudent = async function(session_id, student_id) {
  const result = await pool.query(
    "SELECT * FROM attempts WHERE session_id = $1 AND student_id = $2",
    [session_id, student_id]
  );
  return result.rows[0] || null;
};

exports.getAttemptById = async function(attempt_id, student_id) {
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
};

exports.submitAttempt = async function(attempt_id, student_id) {
  const result = await pool.query(
    `UPDATE attempts 
     SET status = 'submitted', submitted_at = NOW() 
     WHERE id = $1 AND student_id = $2 
     RETURNING *`,
    [attempt_id, student_id]
  );
  return result.rows[0] || null;
};

exports.saveAnswer = async function({ attempt_id, question_id, answer_id, student_id }) {
  const result = await pool.query(
    `INSERT INTO attempt_answers (attempt_id, question_id, chosen_answer_id, student_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (attempt_id, question_id) 
     DO UPDATE SET chosen_answer_id = $3, updated_at = NOW()
     RETURNING *`,
    [attempt_id, question_id, answer_id, student_id]
  );
  return result.rows[0];
};

exports.removeAnswer = async function({ attempt_id, question_id, student_id }) {
  const result = await pool.query(
    `DELETE FROM attempt_answers 
     WHERE attempt_id = $1 AND question_id = $2 AND student_id = $3`,
    [attempt_id, question_id, student_id]
  );
  return result.rowCount > 0;
};

exports.getStudentHistory = async function(student_id) {
  const result = await pool.query(
    `SELECT 
       a.id as attempt_id,
       a.status,
       a.score,
       a.started_at,
       a.submitted_at,
       e.title as exam_title,
       s.name as subject_name,
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
};

exports.getAttemptDetails = async function(attempt_id, student_id) {
  const result = await pool.query(
    `SELECT 
       q.id as question_id,
       q.content as question_content,
       qa.id as answer_id,
       qa.content as answer_content,
       qa.is_correct,
       aa.chosen_answer_id
     FROM questions q
     JOIN question_answers qa ON q.id = qa.question_id
     LEFT JOIN attempt_answers aa ON q.id = aa.question_id AND aa.attempt_id = $1
     WHERE q.id IN (
       SELECT question_id FROM exam_set_questions esq
       JOIN exam_sets es ON esq.exam_set_id = es.id
       JOIN attempts a ON es.id = a.exam_set_id
       WHERE a.id = $1 AND a.student_id = $2
     )
     ORDER BY q.id, qa.id`,
    [attempt_id, student_id]
  );
  return result.rows;
};