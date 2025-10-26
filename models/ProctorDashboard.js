const pool = require("../db");

// Removed unused getDashboardData function

exports.recordViolation = async function(attemptId, proctorId, type, description) {
  // Kiểm tra attempt có thuộc ca thi mà proctor được phân công không
  const attemptCheck = await pool.query(
    `SELECT 1 FROM attempts a
     JOIN exam_sessions es ON a.session_id = es.id
     WHERE a.id = $1 AND es.proctor_id = $2`,
    [attemptId, proctorId]
  );

  if (attemptCheck.rows.length === 0) {
    throw new Error("Bạn không có quyền ghi nhận vi phạm cho sinh viên này");
  }

  const result = await pool.query(
    `INSERT INTO exam_violation_logs (attempt_id, proctor_id, type, description)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [attemptId, proctorId, type, description]
  );

  return result.rows[0];
};

exports.reportIncident = async function(sessionId, proctorId, type, description, severity) {
  // Kiểm tra proctor có được phân công ca thi này không
  const sessionCheck = await pool.query(
    "SELECT 1 FROM exam_sessions WHERE id = $1 AND proctor_id = $2",
    [sessionId, proctorId]
  );

  if (sessionCheck.rows.length === 0) {
    throw new Error("Bạn không được phân công ca thi này");
  }

  const result = await pool.query(
    `INSERT INTO exam_incidents (session_id, proctor_id, type, description, severity)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [sessionId, proctorId, type, description, severity]
  );

  return result.rows[0];
};
