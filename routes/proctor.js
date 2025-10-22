const express = require("express");
const pool = require("../db");
const { requireAuth, allowRoles } = require("../middleware/auth");
const router = express.Router();

// Lấy dashboard tổng quan
router.get(
  "/dashboard",
  requireAuth,
  allowRoles("teacher", "proctor"),
  async (req, res) => {
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
      JOIN exam_sessions es ON a.session_id = es.id
      JOIN users u ON a.student_id = u.id
      WHERE vl.created_at >= NOW() - INTERVAL '2 hours'
      ORDER BY vl.created_at DESC
      LIMIT 10
    `;

      // Lấy sự cố chưa xử lý
      const pendingIncidentsQuery = `
      SELECT 
        ir.id,
        u.full_name as student_name,
        COALESCE(es.room, 'N/A') as room,
        ir.description,
        ir.created_at as timestamp
      FROM incident_reports ir
      JOIN exam_sessions es ON ir.session_id = es.id
      JOIN users u ON ir.student_id = u.id
      WHERE ir.resolved = false
      ORDER BY ir.created_at DESC
      LIMIT 10
    `;

      // Lấy thống kê tổng quan
      const statsQuery = `
      SELECT 
        COUNT(DISTINCT a.id) FILTER (WHERE a.status IS NOT NULL) as total_students,
        COUNT(CASE WHEN a.status = 'in_progress' THEN 1 END) as total_taking,
        COUNT(CASE WHEN a.status = 'submitted' THEN 1 END) as total_submitted,
        COUNT(CASE WHEN a.status = 'disconnected' THEN 1 END) as total_disconnected,
        COUNT(DISTINCT vl.id) as total_violations,
        COUNT(DISTINCT ir.id) FILTER (WHERE ir.resolved = false) as total_incidents
      FROM exam_sessions es
      LEFT JOIN attempts a ON es.id = a.session_id
      LEFT JOIN exam_violation_logs vl ON a.id = vl.attempt_id
      LEFT JOIN incident_reports ir ON es.id = ir.session_id
      WHERE es.start_at <= NOW() AND es.end_at >= NOW()
    `;

      const [
        activeSessionsResult,
        recentViolationsResult,
        pendingIncidentsResult,
        statsResult,
      ] = await Promise.all([
        pool.query(activeSessionsQuery),
        pool.query(recentViolationsQuery),
        pool.query(pendingIncidentsQuery),
        pool.query(statsQuery),
      ]);

      const statistics = statsResult.rows[0] || {
        total_students: 0,
        total_taking: 0,
        total_submitted: 0,
        total_disconnected: 0,
        total_violations: 0,
        total_incidents: 0,
      };

      res.json({
        activeSessions: activeSessionsResult.rows,
        recentViolations: recentViolationsResult.rows,
        pendingIncidents: pendingIncidentsResult.rows,
        statistics: {
          totalStudents: parseInt(statistics.total_students) || 0,
          totalTaking: parseInt(statistics.total_taking) || 0,
          totalSubmitted: parseInt(statistics.total_submitted) || 0,
          totalDisconnected: parseInt(statistics.total_disconnected) || 0,
          totalViolations: parseInt(statistics.total_violations) || 0,
          totalIncidents: parseInt(statistics.total_incidents) || 0,
        },
      });
    } catch (err) {
      console.error("Lỗi dashboard:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Lấy ca thi được phân công
router.get(
  "/assigned-sessions",
  requireAuth,
  allowRoles("teacher", "proctor"),
  async (req, res) => {
    try {
      const query = `
      SELECT 
        es.id as session_id,
        e.title as exam_title,
        s.name as subject_name,
        es.start_at,
        es.end_at,
        COALESCE(es.room, 'Chưa phân phòng') as room,
        CASE 
          WHEN NOW() < es.start_at THEN 'upcoming'
          WHEN NOW() BETWEEN es.start_at AND es.end_at THEN 'ongoing'
          ELSE 'completed'
        END as status
      FROM exam_sessions es
      JOIN exams e ON es.exam_id = e.id
      JOIN subjects s ON e.subject_id = s.id
      WHERE es.proctor_id = $1 OR s.teacher_id = $1
      ORDER BY es.start_at DESC
    `;

      const result = await pool.query(query, [req.user.id]);
      res.json(result.rows);
    } catch (err) {
      console.error("Lỗi lấy ca thi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Lấy chi tiết ca thi
router.get(
  "/sessions/:sessionId/details",
  requireAuth,
  allowRoles("teacher", "proctor"),
  async (req, res) => {
    const { sessionId } = req.params;

    try {
      // Lấy danh sách thí sinh
      const studentsQuery = `
      SELECT 
        u.id as student_id,
        u.full_name as student_name,
        u.email as student_code,
        COALESCE(a.status, 'not_started') as status,
        a.started_at as start_time,
        a.submitted_at as submit_time,
        a.last_activity,
        COUNT(vl.id) as violations_count
      FROM users u
      LEFT JOIN attempts a ON u.id = a.student_id AND a.session_id = $1
      LEFT JOIN exam_violation_logs vl ON a.id = vl.attempt_id
      WHERE u.role = 'student'
      GROUP BY u.id, u.full_name, u.email, a.status, a.started_at, a.submitted_at, a.last_activity
      ORDER BY u.full_name
    `;

      // Lấy vi phạm của ca thi
      const violationsQuery = `
      SELECT 
        vl.id,
        u.id as student_id,
        u.full_name as student_name,
        vl.type,
        vl.description,
        vl.created_at
      FROM exam_violation_logs vl
      JOIN attempts a ON vl.attempt_id = a.id
      JOIN users u ON a.student_id = u.id
      WHERE a.session_id = $1
      ORDER BY vl.created_at DESC
    `;

      // Lấy sự cố của ca thi
      const incidentsQuery = `
      SELECT 
        ir.id,
        u.id as student_id,
        u.full_name as student_name,
        ir.description,
        ir.resolved,
        ir.created_at
      FROM incident_reports ir
      JOIN users u ON ir.student_id = u.id
      WHERE ir.session_id = $1
      ORDER BY ir.created_at DESC
    `;

      const [studentsResult, violationsResult, incidentsResult] =
        await Promise.all([
          pool.query(studentsQuery, [sessionId]),
          pool.query(violationsQuery, [sessionId]),
          pool.query(incidentsQuery, [sessionId]),
        ]);

      res.json({
        students: studentsResult.rows,
        violations: violationsResult.rows,
        incidents: incidentsResult.rows,
      });
    } catch (err) {
      console.error("Lỗi chi tiết ca thi:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Ghi nhận vi phạm
router.post(
  "/violations",
  requireAuth,
  allowRoles("teacher", "proctor"),
  async (req, res) => {
    const { studentId, sessionId, type, description } = req.body;

    if (!studentId || !sessionId || !type || !description) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
    }

    try {
      // Tìm attempt_id
      const attemptQuery = `
      SELECT id FROM attempts 
      WHERE student_id = $1 AND session_id = $2
    `;
      const attemptResult = await pool.query(attemptQuery, [
        studentId,
        sessionId,
      ]);

      if (attemptResult.rows.length === 0) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy bài thi của sinh viên" });
      }

      const attemptId = attemptResult.rows[0].id;

      // Thêm vi phạm
      const violationQuery = `
      INSERT INTO exam_violation_logs (attempt_id, type, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

      const violationResult = await pool.query(violationQuery, [
        attemptId,
        type,
        description,
      ]);

      res.status(201).json({
        message: "Đã ghi nhận vi phạm",
        violation: violationResult.rows[0],
      });
    } catch (err) {
      console.error("Lỗi ghi vi phạm:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Báo cáo sự cố
router.post(
  "/incidents",
  requireAuth,
  allowRoles("teacher", "proctor"),
  async (req, res) => {
    const { studentId, sessionId, description } = req.body;

    if (!studentId || !sessionId || !description) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
    }

    try {
      const incidentQuery = `
      INSERT INTO incident_reports (session_id, student_id, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

      const incidentResult = await pool.query(incidentQuery, [
        sessionId,
        studentId,
        description,
      ]);

      res.status(201).json({
        message: "Đã báo cáo sự cố",
        incident: incidentResult.rows[0],
      });
    } catch (err) {
      console.error("Lỗi báo cáo sự cố:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Lấy thông tin giám sát sinh viên chi tiết
router.get(
  "/students/:studentId/monitor",
  requireAuth,
  allowRoles("teacher", "proctor"),
  async (req, res) => {
    const { studentId } = req.params;
    const { sessionId } = req.query;

    try {
      // Lấy thông tin sinh viên và attempt
      const studentInfoQuery = `
      SELECT 
        u.id as student_id,
        u.full_name as student_name,
        u.email as student_code,
        COALESCE(a.status, 'not_started') as status,
        a.started_at as start_time,
        COALESCE(a.current_question, 1) as current_question,
        COALESCE(e.question_count, 30) as total_questions,
        GREATEST(0, EXTRACT(EPOCH FROM (es.end_at - NOW())))::INTEGER as time_remaining,
        COALESCE(a.tab_switches, 0) as tab_switches,
        COALESCE(a.browser_focus_lost, 0) as browser_focus_lost,
        a.ip_address,
        a.user_agent
      FROM users u
      LEFT JOIN attempts a ON u.id = a.student_id AND a.session_id = $2
      LEFT JOIN exam_sessions es ON a.session_id = es.id
      LEFT JOIN exams e ON es.exam_id = e.id
      WHERE u.id = $1
    `;

      // Lấy hoạt động gần đây
      const activitiesQuery = `
      SELECT 
        'violation' as type,
        vl.description,
        vl.created_at as timestamp,
        true as isViolation
      FROM exam_violation_logs vl
      JOIN attempts a ON vl.attempt_id = a.id
      WHERE a.student_id = $1 AND a.session_id = $2
      
      UNION ALL
      
      SELECT 
        'login' as type,
        'Đăng nhập vào hệ thống' as description,
        a.started_at as timestamp,
        false as isViolation
      FROM attempts a
      WHERE a.student_id = $1 AND a.session_id = $2 AND a.started_at IS NOT NULL
      
      ORDER BY timestamp DESC
      LIMIT 20
    `;

      // Lấy vi phạm
      const violationsQuery = `
      SELECT 
        vl.id,
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
      WHERE a.student_id = $1 AND a.session_id = $2
      ORDER BY vl.created_at DESC
    `;

      const [studentInfoResult, activitiesResult, violationsResult] =
        await Promise.all([
          pool.query(studentInfoQuery, [studentId, sessionId]),
          pool.query(activitiesQuery, [studentId, sessionId]),
          pool.query(violationsQuery, [studentId, sessionId]),
        ]);

      const studentInfo = studentInfoResult.rows[0];
      if (!studentInfo) {
        return res.status(404).json({ message: "Không tìm thấy sinh viên" });
      }

      res.json({
        studentInfo,
        activities: activitiesResult.rows,
        violations: violationsResult.rows,
      });
    } catch (err) {
      console.error("Lỗi lấy thông tin giám sát sinh viên:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Buộc nộp bài
router.patch(
  "/students/:studentId/force-submit",
  requireAuth,
  allowRoles("teacher", "proctor"),
  async (req, res) => {
    const { studentId } = req.params;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: "Thiếu session ID" });
    }

    try {
      const query = `
      UPDATE attempts 
      SET status = 'submitted', submitted_at = NOW()
      WHERE student_id = $1 AND session_id = $2 AND status = 'in_progress'
      RETURNING *
    `;

      const result = await pool.query(query, [studentId, sessionId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Không tìm thấy bài thi hoặc sinh viên đã nộp bài",
        });
      }

      res.json({
        message: "Đã buộc sinh viên nộp bài",
        attempt: result.rows[0],
      });
    } catch (err) {
      console.error("Lỗi buộc nộp bài:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

// Đánh dấu sự cố đã xử lý
router.patch(
  "/incidents/:incidentId/resolve",
  requireAuth,
  allowRoles("teacher", "proctor"),
  async (req, res) => {
    const { incidentId } = req.params;

    try {
      const query = `
      UPDATE incident_reports 
      SET resolved = true, created_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

      const result = await pool.query(query, [incidentId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Không tìm thấy sự cố" });
      }

      res.json({
        message: "Đã đánh dấu sự cố đã xử lý",
        incident: result.rows[0],
      });
    } catch (err) {
      console.error("Lỗi cập nhật sự cố:", err.message);
      res.status(500).json({ message: "Lỗi server" });
    }
  }
);

module.exports = router;
