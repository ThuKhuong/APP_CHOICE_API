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

exports.listPendingTeachers = async function() {
  const result = await pool.query(
    "SELECT id, full_name, email FROM users WHERE role = 'teacher' AND COALESCE(status,0) = 0 ORDER BY id ASC"
  );
  return result.rows;
};

exports.approveTeacher = async function(id) {
  const result = await pool.query(
    "UPDATE users SET status = 1 WHERE id = $1 AND role = 'teacher' AND COALESCE(status,0) = 0 RETURNING *",
    [id]
  );
  return result.rows[0] || null;
};

exports.updateStatus = async function(id, status) {
  const result = await pool.query(
    "UPDATE users SET status = $1 WHERE id = $2 RETURNING id, full_name, email, status",
    [status, id]
  );
  return result.rows[0] || null;
};

exports.getAvailableProctors = async function() {
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
};

exports.getProctorById = async function(id) {
  const result = await pool.query(
    `SELECT id, full_name, email, role, status
     FROM users 
     WHERE id = $1 AND role IN ('teacher', 'proctor') AND status = 1`,
    [id]
  );
  return result.rows[0] || null;
};

exports.checkProctorConflict = async function(proctorId, sessionId) {
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
};

exports.getAllUsers = async function() {
  const result = await pool.query(
    "SELECT id, full_name, email, role, status FROM users ORDER BY id DESC"
  );
  return result.rows;
};

exports.getDashboardStats = async function() {
  const [usersResult, teachersResult, examsResult, completedResult] = await Promise.all([
    pool.query("SELECT COUNT(*) as count FROM users"),
    pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'teacher' AND status = 1"),
    pool.query("SELECT COUNT(*) as count FROM exams"),
    pool.query("SELECT COUNT(*) as count FROM attempts WHERE submitted_at IS NOT NULL")
  ]);

  return {
    totalUsers: parseInt(usersResult.rows[0].count) || 0,
    totalTeachers: parseInt(teachersResult.rows[0].count) || 0,
    totalExams: parseInt(examsResult.rows[0].count) || 0,
    completedExams: parseInt(completedResult.rows[0].count) || 0,
  };
};

exports.updateUserRole = async function(id, role) {
  const roleValue = Array.isArray(role) ? role.join(',') : role;
  const result = await pool.query(
    "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, full_name, email, role",
    [roleValue, id]
  );
  return result.rows[0] || null;
};

exports.updateUserStatus = async function(id, status) {
  const result = await pool.query(
    "UPDATE users SET status = $1 WHERE id = $2 RETURNING id, full_name, email, role, status",
    [status, id]
  );
  return result.rows[0] || null;
};