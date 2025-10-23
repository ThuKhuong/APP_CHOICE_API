const pool = require("../db");

async function createSession({ exam_id, start_at, end_at, access_code, proctor_id, teacher_id }) {
  // Kiểm tra exam thuộc về teacher
  const examCheck = await pool.query(
    `SELECT 1 FROM exams e 
     JOIN subjects s ON e.subject_id = s.id 
     WHERE e.id = $1 AND s.teacher_id = $2`,
    [exam_id, teacher_id]
  );
  
  if (examCheck.rows.length === 0) {
    return null;
  }
  
  const result = await pool.query(
    `INSERT INTO exam_sessions (exam_id, start_at, end_at, access_code, proctor_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [exam_id, start_at, end_at, access_code, proctor_id]
  );
  return result.rows[0];
}

async function listSessionsByTeacher(teacher_id) {
  const result = await pool.query(
    `SELECT se.*, e.title AS exam_title, s.name AS subject_name
     FROM exam_sessions se
     JOIN exams e ON se.exam_id = e.id
     JOIN subjects s ON e.subject_id = s.id
     WHERE s.teacher_id = $1
     ORDER BY se.id DESC`,
    [teacher_id]
  );
  return result.rows;
}

async function getSessionByAccessCode(access_code) {
  const result = await pool.query(
    "SELECT * FROM exam_sessions WHERE access_code = $1",
    [access_code]
  );
  return result.rows[0] || null;
}

async function getSessionById(session_id, teacher_id) {
  const result = await pool.query(
    `SELECT se.*, e.title AS exam_title, s.name AS subject_name
     FROM exam_sessions se
     JOIN exams e ON se.exam_id = e.id
     JOIN subjects s ON e.subject_id = s.id
     WHERE se.id = $1 AND s.teacher_id = $2`,
    [session_id, teacher_id]
  );
  return result.rows[0] || null;
}

async function updateSession({ session_id, teacher_id, start_at, end_at, access_code }) {
  const result = await pool.query(
    `UPDATE exam_sessions SET start_at = $1, end_at = $2, access_code = $3
     WHERE id = $4 AND exam_id IN (
       SELECT e.id FROM exams e 
       JOIN subjects s ON e.subject_id = s.id 
       WHERE s.teacher_id = $5
     ) RETURNING *`,
    [start_at, end_at, access_code, session_id, teacher_id]
  );
  return result.rows[0] || null;
}

async function deleteSession(session_id, teacher_id) {
  const result = await pool.query(
    `DELETE FROM exam_sessions 
     WHERE id = $1 AND exam_id IN (
       SELECT e.id FROM exams e 
       JOIN subjects s ON e.subject_id = s.id 
       WHERE s.teacher_id = $2
     ) RETURNING *`,
    [session_id, teacher_id]
  );
  return result.rows[0] || null;
}

async function getSessionStats(session_id, teacher_id) {
  const result = await pool.query(
    `SELECT 
       se.id,
       e.title AS exam_title,
       s.name AS subject_name,
       COUNT(DISTINCT a.id) AS total_students,
       COUNT(CASE WHEN a.status = 'in_progress' THEN 1 END) AS taking,
       COUNT(CASE WHEN a.status = 'submitted' THEN 1 END) AS submitted,
       COUNT(CASE WHEN a.status = 'disconnected' THEN 1 END) AS disconnected,
       COUNT(CASE WHEN a.status = 'not_started' THEN 1 END) AS absent,
       COALESCE(AVG(a.score), 0)::numeric(4,2) AS avg_score
     FROM exam_sessions se
     JOIN exams e ON se.exam_id = e.id
     JOIN subjects s ON e.subject_id = s.id
     LEFT JOIN attempts a ON a.session_id = se.id
     WHERE se.id = $1 AND s.teacher_id = $2
     GROUP BY se.id, e.title, s.name`,
    [session_id, teacher_id]
  );
  return result.rows[0] || null;
}

module.exports = {
  createSession,
  listSessionsByTeacher,
  getSessionByAccessCode,
  getSessionById,
  updateSession,
  deleteSession,
  getSessionStats,
};
