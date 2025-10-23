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

module.exports = {
  findByEmail,
  createStudent,
  createTeacherPending,
  listPendingTeachers,
  approveTeacher,
  rejectPendingTeacher,
  updateStatus,
};


