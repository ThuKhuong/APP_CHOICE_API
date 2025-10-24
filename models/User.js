const pool = require("../db");

async function findByEmail(email) {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0] || null;
}

async function createStudent({ full_name, email, password_hash }) {
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'student', 1)
     RETURNING id, full_name, email, role, status`,
    [full_name, email, password_hash]
  );
  return result.rows[0];
}

async function createTeacherPending({ full_name, email, password_hash }) {
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'teacher', 0)
     RETURNING id, full_name, email, role, status`,
    [full_name, email, password_hash]
  );
  return result.rows[0];
}

async function listPendingTeachers() {
  const result = await pool.query(
    "SELECT id, full_name, email, created_at FROM users WHERE role = 'teacher' AND COALESCE(status,0) = 0 ORDER BY created_at ASC"
  );
  return result.rows;
}

async function approveTeacher(id) {
  const result = await pool.query(
    "UPDATE users SET status = 1 WHERE id = $1 AND role = 'teacher' AND COALESCE(status,0) = 0 RETURNING *",
    [id]
  );
  return result.rows[0] || null;
}

async function rejectPendingTeacher(id) {
  const result = await pool.query(
    "DELETE FROM users WHERE id = $1 AND role = 'teacher' AND COALESCE(status,0) = 0 RETURNING *",
    [id]
  );
  return result.rows[0] || null;
}

async function updateStatus(id, status) {
  const result = await pool.query(
    "UPDATE users SET status = $1 WHERE id = $2 RETURNING id, full_name, email, status",
    [status, id]
  );
  return result.rows[0] || null;
}

async function getAvailableProctors() {
  const result = await pool.query(
    `SELECT 
       u.id,
       u.full_name,
       u.email,
       u.role,
       0 as assigned_sessions_count,
       'available' as availability_status
     FROM users u
     WHERE u.role LIKE '%proctor%'
       AND u.status = 1
     ORDER BY u.full_name`
  );
  return result.rows;
}

async function getProctorById(id) {
  const result = await pool.query(
    `SELECT id, full_name, email, role, status
     FROM users 
     WHERE id = $1 AND role IN ('teacher', 'proctor') AND status = 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function checkProctorConflict(proctorId, sessionId) {
  const result = await pool.query(
    `SELECT es.id, es.start_at, es.end_at, e.title
     FROM exam_sessions es
     JOIN exams e ON es.exam_id = e.id
     WHERE es.proctor_id = $1 
     AND es.id != $2
     AND (
       (es.start_at <= (SELECT start_at FROM exam_sessions WHERE id = $2) 
        AND es.end_at > (SELECT start_at FROM exam_sessions WHERE id = $2))
       OR
       (es.start_at < (SELECT end_at FROM exam_sessions WHERE id = $2) 
        AND es.end_at >= (SELECT end_at FROM exam_sessions WHERE id = $2))
       OR
       (es.start_at >= (SELECT start_at FROM exam_sessions WHERE id = $2) 
        AND es.end_at <= (SELECT end_at FROM exam_sessions WHERE id = $2))
     )`,
    [proctorId, sessionId]
  );
  return result.rows;
}

module.exports = {
  findByEmail,
  createStudent,
  createTeacherPending,
  listPendingTeachers,
  approveTeacher,
  rejectPendingTeacher,
  updateStatus,
  getAvailableProctors,
  getProctorById,
  checkProctorConflict,
};


