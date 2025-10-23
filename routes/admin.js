const express = require("express");
const pool = require("../db");
const { requireAuth, allowRoles } = require("../middleware/auth");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const adminController = require("../controllers/adminController");

const router = express.Router();
const SECRET = process.env.JWT_SECRET || "secret123";

// Auth guard for all admin routes
router.use(requireAuth);

// Lấy danh sách tất cả người dùng
router.get("/users", allowRoles("admin"), adminController.listUsers);

// Lấy danh sách đăng ký chờ duyệt (pending_teacher)
router.get("/pending-teachers", allowRoles("admin"), adminController.listPendingTeachers);

// Duyệt đăng ký giáo viên
router.put("/approve-teacher/:id", allowRoles("admin"), adminController.approveTeacher);

// Cập nhật role của người dùng
router.put("/users/:id/role", allowRoles("admin"), adminController.updateUserRole);

// Khóa/mở khóa tài khoản
router.put("/users/:id/status", allowRoles("admin"), adminController.updateUserStatus);

// Thống kê tổng quan hệ thống
router.get("/dashboard", allowRoles("admin"), adminController.dashboard);

// Tạo tài khoản admin mới (chỉ admin mới có thể tạo admin khác)
router.post("/create-admin", allowRoles("admin"), adminController.createAdmin);

module.exports = router;
