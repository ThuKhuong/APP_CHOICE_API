const pool = require("../db");

exports.assignProctorToSession = async (sessionId, proctorId) => {
  await pool.query("DELETE FROM proctor_assignments WHERE session_id = $1", [sessionId]);

  const result = await pool.query(
    `INSERT INTO proctor_assignments (session_id, proctor_id)
     VALUES ($1, $2)
     RETURNING *`,
    [sessionId, proctorId]
  );
  return result.rows[0];
};

exports.getAssignedSessions = async (proctorId) => {
  const result = await pool.query(
    `SELECT 
       es.id,
       es.access_code,
       e.title as exam_title,
       s.name as subject_name,
       es.start_at,
       es.end_at,
       NULL as room,
       pa.proctor_id,
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
     JOIN proctor_assignments pa ON es.id = pa.session_id
     JOIN exams e ON es.exam_id = e.id
     JOIN subjects s ON e.subject_id = s.id
     JOIN users u ON s.teacher_id = u.id
     LEFT JOIN attempts a ON es.id = a.session_id
     LEFT JOIN exam_violation_logs vl ON a.id = vl.attempt_id
     WHERE pa.proctor_id = $1
     GROUP BY es.id, es.access_code, e.title, s.name, es.start_at, es.end_at, pa.proctor_id, u.full_name, u.email
     ORDER BY es.start_at DESC`,
    [proctorId]
  );
  return result.rows;
};

exports.getSessionDetails = async (sessionId, proctorId) => {
  const sessionCheck = await pool.query(
    "SELECT 1 FROM proctor_assignments WHERE session_id = $1 AND proctor_id = $2",
    [sessionId, proctorId]
  );
  if (sessionCheck.rows.length === 0) throw new Error("Bạn không được phân công ca thi này");

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

  return { session: sessionDetails.rows[0], students: students.rows };
};

exports.getSessionStudents = async (sessionId, proctorId) => {
  const sessionCheck = await pool.query(
    "SELECT 1 FROM proctor_assignments WHERE session_id = $1 AND proctor_id = $2",
    [sessionId, proctorId]
  );
  if (sessionCheck.rows.length === 0) throw new Error("Bạn không được phân công ca thi này");

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
       COUNT(vl.id) as violation_count,
       CASE 
         WHEN a.status = 'in_progress' THEN 'Đang thi'
         WHEN a.status = 'submitted' THEN 'Đã nộp bài'
         WHEN a.status = 'locked' THEN 'Bị khóa'
         ELSE 'Chưa bắt đầu'
       END as status_text,
       CASE 
         WHEN a.status = 'in_progress' THEN 'processing'
         WHEN a.status = 'submitted' THEN 'success'
         WHEN a.status = 'locked' THEN 'error'
         ELSE 'default'
       END as status_color
     FROM attempts a
     JOIN users u ON a.student_id = u.id
     LEFT JOIN exam_violation_logs vl ON a.id = vl.attempt_id
     WHERE a.session_id = $1
     GROUP BY a.id, u.id, u.full_name, u.email, a.status, a.started_at, a.submitted_at, a.score
     ORDER BY u.full_name`,
    [sessionId]
  );

  const sessionInfo = await pool.query(
    `SELECT 
       es.id,
       es.access_code,
       e.title as exam_title,
       s.name as subject_name,
       es.start_at,
       es.end_at,
       es.status as session_status
     FROM exam_sessions es
     JOIN exams e ON es.exam_id = e.id
     JOIN subjects s ON e.subject_id = s.id
     WHERE es.id = $1`,
    [sessionId]
  );

  return {
    session: sessionInfo.rows[0],
    students: students.rows,
    total_students: students.rows.length,
    in_progress: students.rows.filter(s => s.status === 'in_progress').length,
    submitted: students.rows.filter(s => s.status === 'submitted').length,
    locked: students.rows.filter(s => s.status === 'locked').length,
  };
};

exports.lockAttempt = async (attemptId, proctorId, reason) => {
  const attemptCheck = await pool.query(
    `SELECT a.id, a.session_id, a.student_id, a.status
     FROM attempts a
     JOIN proctor_assignments pa ON a.session_id = pa.session_id
     WHERE a.id = $1 AND pa.proctor_id = $2`,
    [attemptId, proctorId]
  );

  if (attemptCheck.rows.length === 0) throw new Error("Bạn không có quyền khóa bài thi này");

  const attempt = attemptCheck.rows[0];
  if (attempt.status === "submitted") throw new Error("Không thể khóa bài thi đã nộp");
  if (attempt.status === "locked") throw new Error("Bài thi đã bị khóa");

  const result = await pool.query(
    `UPDATE attempts SET status = 'locked' WHERE id = $1 RETURNING *`,
    [attemptId]
  );

  await pool.query(
    `INSERT INTO exam_violation_logs (attempt_id, type, description)
     VALUES ($1, $2, $3)`,
    [attemptId, "locked_by_proctor", reason || "Bài thi bị khóa bởi giám thị"]
  );

  return result.rows[0];
};

exports.getIssueReports = async (proctorId) => {
  const result = await pool.query(
    `SELECT 
       ir.id,
       ir.attempt_id,
       ir.question_id,
       ir.issue_type,
       ir.note,
       ir.resolved,
       ir.created_at,
       q.content as question_content,
       u.full_name as student_name,
       u.email as student_email,
       es.access_code,
       e.title as exam_title,
       s.name as subject_name
     FROM issue_reports ir
     JOIN attempts a ON ir.attempt_id = a.id
     JOIN exam_sessions es ON a.session_id = es.id
     JOIN proctor_assignments pa ON es.id = pa.session_id
     JOIN questions q ON ir.question_id = q.id
     JOIN users u ON a.student_id = u.id
     JOIN exams e ON es.exam_id = e.id
     JOIN subjects s ON e.subject_id = s.id
     WHERE pa.proctor_id = $1
     ORDER BY ir.created_at DESC`,
    [proctorId]
  );
  return result.rows;
};

exports.resolveIssueReport = async (reportId, proctorId, action, replacement_question_id, note) => {
  const reportCheck = await pool.query(
    `SELECT ir.id, ir.question_id, ir.attempt_id
     FROM issue_reports ir
     JOIN attempts a ON ir.attempt_id = a.id
     JOIN exam_sessions es ON a.session_id = es.id
     JOIN proctor_assignments pa ON es.id = pa.session_id
     WHERE ir.id = $1 AND pa.proctor_id = $2`,
    [reportId, proctorId]
  );

  if (reportCheck.rows.length === 0) throw new Error("Bạn không có quyền xử lý báo lỗi này");

  const report = reportCheck.rows[0];
  await pool.query(`UPDATE issue_reports SET resolved = true WHERE id = $1`, [reportId]);

  let type = "", description = "";
  if (action === "fix_typo") {
    type = "question_fixed";
    description = `Sửa lỗi câu hỏi: ${note}`;
  } else if (action === "replace_question") {
    type = "question_replaced";
    description = `Thay thế câu hỏi: ${note}`;
  } else if (action === "disable_question") {
    type = "question_disabled";
    description = `Vô hiệu hóa câu hỏi: ${note}`;
  }

  await pool.query(
    `INSERT INTO exam_violation_logs (attempt_id, type, description)
     VALUES ($1, $2, $3)`,
    [report.attempt_id, type, description]
  );

  return { reportId, action, note };
};

exports.checkSessionOwnership = async (sessionId, teacherId) => {
  const result = await pool.query(
    `SELECT es.id, e.title, s.teacher_id
     FROM exam_sessions es
     JOIN exams e ON es.exam_id = e.id
     JOIN subjects s ON e.subject_id = s.id
     WHERE es.id = $1 AND s.teacher_id = $2`,
    [sessionId, teacherId]
  );
  return result.rows[0] || null;
};
