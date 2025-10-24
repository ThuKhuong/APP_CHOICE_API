const pool = require("../db");

async function assignProctorToSession(sessionId, proctorId) {
  const result = await pool.query(
    `UPDATE exam_sessions 
     SET proctor_id = $1 
     WHERE id = $2 
     RETURNING *`,
    [proctorId, sessionId]
  );
  return result.rows[0];
}

async function getAssignedSessions(proctorId) {
  const result = await pool.query(
    `SELECT 
       es.id,
       es.access_code,
       e.title as exam_title,
       s.name as subject_name,
       es.start_at,
       es.end_at,
       es.room,
       es.proctor_id,
       u.full_name as teacher_name,
       u.email as teacher_email,
       COUNT(DISTINCT a.id) as total_students,
       COUNT(CASE WHEN a.status = 'in_progress' THEN 1 END) as taking,
       COUNT(CASE WHEN a.status = 'submitted' THEN 1 END) as submitted,
       COUNT(CASE WHEN a.status = 'disconnected' THEN 1 END) as disconnected,
       COUNT(CASE WHEN a.status = 'not_started' THEN 1 END) as not_started,
       COUNT(DISTINCT vl.id) as violation_count,
       CASE 
         WHEN es.start_at > NOW() THEN 'upcoming'
         WHEN es.end_at < NOW() THEN 'completed'
         ELSE 'active'
       END as session_status
     FROM exam_sessions es
     JOIN exams e ON es.exam_id = e.id
     JOIN subjects s ON e.subject_id = s.id
     JOIN users u ON s.teacher_id = u.id
     LEFT JOIN attempts a ON es.id = a.session_id
     LEFT JOIN exam_violation_logs vl ON a.id = vl.attempt_id
     WHERE es.proctor_id = $1
     GROUP BY es.id, es.access_code, e.title, s.name, es.start_at, es.end_at, es.room, es.proctor_id, u.full_name, u.email
     ORDER BY es.start_at DESC`,
    [proctorId]
  );
  return result.rows;
}

async function getSessionDetails(sessionId, proctorId) {
  // Kiểm tra proctor có được phân công ca thi này không
  const sessionCheck = await pool.query(
    "SELECT 1 FROM exam_sessions WHERE id = $1 AND proctor_id = $2",
    [sessionId, proctorId]
  );

  if (sessionCheck.rows.length === 0) {
    throw new Error("Bạn không được phân công ca thi này");
  }

  // Lấy chi tiết ca thi
  const sessionDetails = await pool.query(
    `SELECT 
       es.*,
       e.title as exam_title,
       s.name as subject_name,
       u.full_name as proctor_name
     FROM exam_sessions es
     JOIN exams e ON es.exam_id = e.id
     JOIN subjects s ON e.subject_id = s.id
     LEFT JOIN users u ON es.proctor_id = u.id
     WHERE es.id = $1`,
    [sessionId]
  );

  // Lấy danh sách sinh viên
  const students = await pool.query(
    `SELECT 
       a.id as attempt_id,
       u.id as student_id,
       u.full_name,
       u.email,
       a.status,
       a.started_at,
       a.submitted_at,
       a.score,
       COUNT(vl.id) as violation_count
     FROM attempts a
     JOIN users u ON a.student_id = u.id
     LEFT JOIN exam_violation_logs vl ON a.id = vl.attempt_id
     WHERE a.session_id = $1
     GROUP BY a.id, u.id, u.full_name, u.email, a.status, a.started_at, a.submitted_at, a.score
     ORDER BY u.full_name`,
    [sessionId]
  );

  return {
    session: sessionDetails.rows[0],
    students: students.rows
  };
}

async function checkSessionOwnership(sessionId, teacherId) {
  const result = await pool.query(
    `SELECT es.id, e.title, s.teacher_id
     FROM exam_sessions es
     JOIN exams e ON es.exam_id = e.id
     JOIN subjects s ON e.subject_id = s.id
     WHERE es.id = $1 AND s.teacher_id = $2`,
    [sessionId, teacherId]
  );
  return result.rows[0] || null;
}

module.exports = {
  assignProctorToSession,
  getAssignedSessions,
  getSessionDetails,
  checkSessionOwnership,
};
