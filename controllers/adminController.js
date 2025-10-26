const Auth = require("../models/Auth");
const User = require("../models/User");

// USER MANAGEMENT
exports.listUsers = async function(req, res) {
  try {
    const users = await User.getAllUsers();
    res.json(users);
  } catch (err) {
    console.error("Lỗi lấy danh sách người dùng:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.listPendingTeachers = async function(req, res) {
  try {
    const teachers = await User.listPendingTeachers();
    res.json(teachers);
  } catch (err) {
    console.error("Lỗi lấy danh sách giáo viên chờ duyệt:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.approveTeacher = async function(req, res) {
  try {
    const { id } = req.params;
    const result = await User.approveTeacher(id);
    
    if (!result) {
      return res.status(404).json({ message: "Không tìm thấy giáo viên" });
    }
    
    res.json({ message: "Duyệt giáo viên thành công" });
  } catch (err) {
    console.error("Lỗi duyệt giáo viên:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.updateUserRole = async function(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!role || !['admin', 'teacher', 'student', 'proctor'].includes(role)) {
      return res.status(400).json({ message: "Role không hợp lệ" });
    }
    
    const result = await User.updateUserRole(id, role);
    if (!result) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    
    res.json({ message: "Cập nhật role thành công" });
  } catch (err) {
    console.error("Lỗi cập nhật role:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.updateUserStatus = async function(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (status === undefined || (status !== 0 && status !== 1)) {
      return res.status(400).json({ message: "Status phải là 0 hoặc 1" });
    }
    
    const result = await User.updateUserStatus(id, status);
    if (!result) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    
    res.json({ message: "Cập nhật trạng thái thành công" });
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// DASHBOARD
exports.dashboard = async function(req, res) {
  try {
    const stats = await User.getDashboardStats();
    res.json(stats);
  } catch (err) {
    console.error("Lỗi lấy thống kê dashboard:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getAllExams = async function(req, res) {
  try {
    const pool = require("../db");
    const result = await pool.query(
      `SELECT e.*, s.name AS subject_name
       FROM exams e
       JOIN subjects s ON e.subject_id = s.id
       ORDER BY e.id DESC
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Lỗi lấy danh sách bài thi:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};