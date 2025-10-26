const pool = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.findByEmail = async function(email) {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0] || null;
};

exports.checkEmailExists = async function(email) {
  const result = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  return result.rows.length > 0;
};

exports.hashPassword = async function(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

exports.generateToken = function(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "24h" }
  );
};

exports.validateLogin = async function(email, password) {
  const user = await exports.findByEmail(email);
  if (!user) {
    throw new Error("Người dùng không tồn tại");
  }
  
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new Error("Mật khẩu không đúng");
  }
  
  // Kiểm tra status - chỉ cho phép đăng nhập nếu status = 1 (đã kích hoạt)
  if (user.status !== 1) {
    throw new Error("Tài khoản chưa được kích hoạt. Vui lòng liên hệ quản trị viên");
  }
  
  return user;
};

exports.getUserById = async function(userId) {
  const result = await pool.query("SELECT id, full_name, email, role, status FROM users WHERE id = $1", [userId]);
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