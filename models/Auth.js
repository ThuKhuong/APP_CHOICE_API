const pool = require("../db");

exports.findByEmail = async function(email) {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0] || null;
};

exports.createStudent = async function({ full_name, email, password_hash }) {
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'student', 1)
     RETURNING id, full_name, email, role, status`,
    [full_name, email, password_hash]
  );
  return result.rows[0];
};

exports.createTeacherPending = async function({ full_name, email, password_hash }) {
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'teacher', 0)
     RETURNING id, full_name, email, role, status`,
    [full_name, email, password_hash]
  );
  return result.rows[0];
};