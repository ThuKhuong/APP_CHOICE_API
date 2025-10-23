const User = require("../models/User");
const pool = require("../db");

async function listUsers(req, res) {
  try {
    const result = await pool.query(
      "SELECT id, full_name, email, role, status, created_at FROM users ORDER BY created_at DESC"
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error("Lỗi lấy danh sách users:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function listPendingTeachers(req, res) {
  try {
    const pending = await User.listPendingTeachers();
    res.json({ pending_teachers: pending });
  } catch (err) {
    console.error("Lỗi lấy danh sách pending teachers:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function approveTeacher(req, res) {
  const { id } = req.params;
  const { action } = req.body;
  try {
    if (action === "approve") {
      const user = await User.approveTeacher(id);
      if (!user) return res.status(404).json({ message: "Không tìm thấy đăng ký chờ duyệt" });
      res.json({ message: "Duyệt đăng ký thành công", user });
    } else if (action === "reject") {
      const user = await User.rejectPendingTeacher(id);
      if (!user) return res.status(404).json({ message: "Không tìm thấy đăng ký chờ duyệt" });
      res.json({ message: "Từ chối đăng ký thành công" });
    } else {
      res.status(400).json({ message: "Action không hợp lệ" });
    }
  } catch (err) {
    console.error("Lỗi duyệt đăng ký:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function updateUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body;
  const allowedRoles = ['teacher', 'student', 'proctor', 'admin'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Role không hợp lệ" });
  }
  try {
    const result = await pool.query(
      "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, full_name, email, role",
      [role, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    res.json({ message: "Cập nhật role thành công", user: result.rows[0] });
  } catch (err) {
    console.error("Lỗi cập nhật role:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function updateUserStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const user = await User.updateStatus(id, status);
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    res.json({ message: "Cập nhật trạng thái thành công", user });
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function dashboard(req, res) {
  try {
    const roleStats = await pool.query(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role
    `);
    const [subjectsCount, questionsCount, examsCount, sessionsCount] = await Promise.all([
      pool.query("SELECT COUNT(*) as count FROM subjects"),
      pool.query("SELECT COUNT(*) as count FROM questions"),
      pool.query("SELECT COUNT(*) as count FROM exams"),
      pool.query("SELECT COUNT(*) as count FROM exam_sessions"),
    ]);
    res.json({
      role_stats: roleStats.rows,
      total_subjects: parseInt(subjectsCount.rows[0].count),
      total_questions: parseInt(questionsCount.rows[0].count),
      total_exams: parseInt(examsCount.rows[0].count),
      total_sessions: parseInt(sessionsCount.rows[0].count),
    });
  } catch (err) {
    console.error("Lỗi lấy thống kê:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function createAdmin(req, res) {
  const { full_name, email, password } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ message: "Thiếu thông tin" });
  }
  try {
    const existing = await User.findByEmail(email);
    if (existing) return res.status(400).json({ message: "Email đã được sử dụng" });
    const bcrypt = require("bcrypt");
    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, full_name, email, role`,
      [full_name, email, password_hash]
    );
    res.status(201).json({ message: "Tạo admin thành công", user: result.rows[0] });
  } catch (err) {
    console.error("Lỗi tạo admin:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

module.exports = {
  listUsers,
  listPendingTeachers,
  approveTeacher,
  updateUserRole,
  updateUserStatus,
  dashboard,
  createAdmin,
};


