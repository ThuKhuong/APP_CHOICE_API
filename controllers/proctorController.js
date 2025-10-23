const pool = require("../db");
const Session = require("../models/Session");

async function getDashboard(req, res) {
  try {
    // Lấy ca thi đang diễn ra
    const activeSessionsQuery = `
      SELECT 
        es.id as session_id,
        e.title as exam_title,
        COALESCE(es.room, 'Chưa phân phòng') as room,
        COUNT(DISTINCT a.id) FILTER (WHERE a.status IS NOT NULL) as total_students,
        COUNT(CASE WHEN a.status = 'in_progress' THEN 1 END) as taking,
        COUNT(CASE WHEN a.status = 'submitted' THEN 1 END) as submitted,
        COUNT(CASE WHEN a.status = 'disconnected' THEN 1 END) as disconnected,
        COUNT(CASE WHEN a.status = 'not_started' THEN 1 END) as absent,
        COUNT(DISTINCT vl.id) as violations,
        TO_CHAR(es.start_at, 'HH24:MI') as start_time,
        TO_CHAR(es.end_at, 'HH24:MI') as end_time,
        GREATEST(0, EXTRACT(EPOCH FROM (es.end_at - NOW())))::INTEGER as time_remaining
      FROM exam_sessions es
      LEFT JOIN exams e ON es.exam_id = e.id
      LEFT JOIN attempts a ON es.id = a.session_id
      LEFT JOIN exam_violation_logs vl ON a.id = vl.attempt_id
      WHERE es.start_at <= NOW() AND es.end_at >= NOW()
      GROUP BY es.id, e.title, es.room, es.start_at, es.end_at
      ORDER BY es.start_at
    `;

    // Lấy vi phạm gần đây
    const recentViolationsQuery = `
      SELECT 
        vl.id,
        u.full_name as student_name,
        COALESCE(es.room, 'N/A') as room,
        vl.type,
        vl.description,
        vl.created_at as timestamp,
        CASE 
          WHEN vl.type IN ('multi_device', 'cheating') THEN 'high'
          WHEN vl.type IN ('tab_out', 'suspicious') THEN 'medium'
          ELSE 'low'
        END as severity
      FROM exam_violation_logs vl
      JOIN attempts a ON vl.attempt_id = a.id
      JOIN users u ON a.student_id = u.id
      JOIN exam_sessions es ON a.session_id = es.id
      WHERE es.start_at <= NOW() AND es.end_at >= NOW()
      ORDER BY vl.created_at DESC
      LIMIT 10
    `;

    const [activeSessions, recentViolations] = await Promise.all([
      pool.query(activeSessionsQuery),
      pool.query(recentViolationsQuery)
    ]);

    res.json({
      active_sessions: activeSessions.rows,
      recent_violations: recentViolations.rows
    });
  } catch (err) {
    console.error("Lỗi lấy dashboard:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function getAssignedSessions(req, res) {
  const proctorId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT 
         es.id,
         es.access_code,
         e.title as exam_title,
         s.name as subject_name,
         es.start_at,
         es.end_at,
         es.room,
         COUNT(DISTINCT a.id) as total_students,
         COUNT(CASE WHEN a.status = 'in_progress' THEN 1 END) as taking,
         COUNT(CASE WHEN a.status = 'submitted' THEN 1 END) as submitted
       FROM exam_sessions es
       JOIN exams e ON es.exam_id = e.id
       JOIN subjects s ON e.subject_id = s.id
       LEFT JOIN attempts a ON es.id = a.session_id
       WHERE es.proctor_id = $1
       GROUP BY es.id, es.access_code, e.title, s.name, es.start_at, es.end_at, es.room
       ORDER BY es.start_at DESC`,
      [proctorId]
    );

    res.json({ sessions: result.rows });
  } catch (err) {
    console.error("Lỗi lấy ca thi được phân công:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function getSessionDetails(req, res) {
  const { sessionId } = req.params;
  const proctorId = req.user.id;

  try {
    // Kiểm tra proctor có được phân công ca thi này không
    const sessionCheck = await pool.query(
      "SELECT 1 FROM exam_sessions WHERE id = $1 AND proctor_id = $2",
      [sessionId, proctorId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(403).json({ message: "Bạn không được phân công ca thi này" });
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

    res.json({
      session: sessionDetails.rows[0],
      students: students.rows
    });
  } catch (err) {
    console.error("Lỗi lấy chi tiết ca thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function recordViolation(req, res) {
  const { attempt_id, type, description } = req.body;
  const proctorId = req.user.id;

  try {
    // Kiểm tra attempt có thuộc ca thi mà proctor được phân công không
    const attemptCheck = await pool.query(
      `SELECT 1 FROM attempts a
       JOIN exam_sessions es ON a.session_id = es.id
       WHERE a.id = $1 AND es.proctor_id = $2`,
      [attempt_id, proctorId]
    );

    if (attemptCheck.rows.length === 0) {
      return res.status(403).json({ message: "Bạn không có quyền ghi nhận vi phạm cho sinh viên này" });
    }

    const result = await pool.query(
      `INSERT INTO exam_violation_logs (attempt_id, proctor_id, type, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [attempt_id, proctorId, type, description]
    );

    res.json({ message: "Ghi nhận vi phạm thành công", violation: result.rows[0] });
  } catch (err) {
    console.error("Lỗi ghi nhận vi phạm:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function reportIncident(req, res) {
  const { session_id, type, description, severity } = req.body;
  const proctorId = req.user.id;

  try {
    // Kiểm tra proctor có được phân công ca thi này không
    const sessionCheck = await pool.query(
      "SELECT 1 FROM exam_sessions WHERE id = $1 AND proctor_id = $2",
      [session_id, proctorId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(403).json({ message: "Bạn không được phân công ca thi này" });
    }

    const result = await pool.query(
      `INSERT INTO exam_incidents (session_id, proctor_id, type, description, severity)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [session_id, proctorId, type, description, severity]
    );

    res.json({ message: "Báo cáo sự cố thành công", incident: result.rows[0] });
  } catch (err) {
    console.error("Lỗi báo cáo sự cố:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function getStudentMonitor(req, res) {
  const { studentId } = req.params;
  const proctorId = req.user.id;

  try {
    // Lấy thông tin sinh viên và ca thi hiện tại
    const studentInfo = await pool.query(
      `SELECT 
         a.id as attempt_id,
         u.full_name,
         u.email,
         es.id as session_id,
         e.title as exam_title,
         es.start_at,
         es.end_at,
         a.status,
         a.started_at,
         a.submitted_at
       FROM attempts a
       JOIN users u ON a.student_id = u.id
       JOIN exam_sessions es ON a.session_id = es.id
       JOIN exams e ON es.exam_id = e.id
       WHERE a.student_id = $1 AND es.proctor_id = $2
       ORDER BY a.started_at DESC
       LIMIT 1`,
      [studentId, proctorId]
    );

    if (studentInfo.rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy sinh viên hoặc bạn không được phân công giám sát" });
    }

    // Lấy lịch sử vi phạm
    const violations = await pool.query(
      `SELECT 
         vl.id,
         vl.type,
         vl.description,
         vl.created_at,
         vl.proctor_id,
         u.full_name as proctor_name
       FROM exam_violation_logs vl
       JOIN users u ON vl.proctor_id = u.id
       WHERE vl.attempt_id = $1
       ORDER BY vl.created_at DESC`,
      [studentInfo.rows[0].attempt_id]
    );

    res.json({
      student: studentInfo.rows[0],
      violations: violations.rows
    });
  } catch (err) {
    console.error("Lỗi lấy thông tin giám sát sinh viên:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

module.exports = {
  getDashboard,
  getAssignedSessions,
  getSessionDetails,
  recordViolation,
  reportIncident,
  getStudentMonitor,
};
