const pool = require("../db");

async function createSession({ exam_id, start_at, end_at, access_code, teacher_id }) {
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
    `INSERT INTO exam_sessions (exam_id, start_at, end_at, access_code)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [exam_id, start_at, end_at, access_code]
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

async function updateSession({ session_id, teacher_id, exam_id, start_at, end_at, access_code }) {
  const result = await pool.query(
    `UPDATE exam_sessions SET exam_id = $1, start_at = $2, end_at = $3, access_code = $4
     WHERE id = $5 AND exam_id IN (
       SELECT e.id FROM exams e 
       JOIN subjects s ON e.subject_id = s.id 
       WHERE s.teacher_id = $6
     ) RETURNING *`,
    [exam_id, start_at, end_at, access_code, session_id, teacher_id]
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

async function getSessionProctor(session_id) {
  const result = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.role
     FROM proctor_assignments pa
     JOIN users u ON pa.proctor_id = u.id
     WHERE pa.session_id = $1`,
    [session_id]
  );
  return result.rows[0] || null;
}

async function assignProctorToSession(session_id, proctor_id) {
  // Xóa assignment cũ nếu có
  await pool.query(
    "DELETE FROM proctor_assignments WHERE session_id = $1",
    [session_id]
  );
  
  // Thêm assignment mới
  const result = await pool.query(
    `INSERT INTO proctor_assignments (session_id, proctor_id)
     VALUES ($1, $2) RETURNING *`,
    [session_id, proctor_id]
  );
  return result.rows[0];
}

async function updateSessionStatus(session_id, status) {
  const result = await pool.query(
    `UPDATE exam_sessions SET status = $1 WHERE id = $2 RETURNING *`,
    [status, session_id]
  );
  return result.rows[0] || null;
}

async function cancelSession(session_id, teacher_id) {
  // Kiểm tra quyền truy cập
  const session = await getSessionById(session_id, teacher_id);
  if (!session) {
    return null;
  }
  
  // Kiểm tra xem ca thi có đang diễn ra không
  const now = new Date();
  const startTime = new Date(session.start_at);
  const endTime = new Date(session.end_at);
  
  if (now >= startTime && now <= endTime) {
    throw new Error("Không thể hủy ca thi đang diễn ra");
  }
  
  return await updateSessionStatus(session_id, 'cancelled');
}

async function updateSessionStatuses() {
  const now = new Date();
  
  // Cập nhật ca thi đang diễn ra
  await pool.query(`
    UPDATE exam_sessions 
    SET status = 'ongoing' 
    WHERE status = 'scheduled' 
      AND start_at <= $1 
      AND end_at >= $1
  `, [now]);
  
  // Cập nhật ca thi đã kết thúc
  await pool.query(`
    UPDATE exam_sessions 
    SET status = 'completed' 
    WHERE status IN ('scheduled', 'ongoing') 
      AND end_at < $1
  `, [now]);
  
  return { updated: true };
}

module.exports = {
  createSession,
  listSessionsByTeacher,
  getSessionByAccessCode,
  getSessionById,
  updateSession,
  deleteSession,
  getSessionStats,
  getSessionProctor,
  assignProctorToSession,
  updateSessionStatus,
  cancelSession,
  updateSessionStatuses,
};
