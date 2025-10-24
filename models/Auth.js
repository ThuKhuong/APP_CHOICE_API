const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const pool = require("../db");

const SECRET = process.env.JWT_SECRET || "secret123";

async function findByEmail(email) {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0] || null;
}

async function createStudent({ full_name, email, password_hash }) {
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'student', 1)
     RETURNING id, full_name, email, role, status`,
    [full_name, email, password_hash]
  );
  return result.rows[0];
}

async function createTeacherPending({ full_name, email, password_hash }) {
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'teacher', 0)
     RETURNING id, full_name, email, role, status`,
    [full_name, email, password_hash]
  );
  return result.rows[0];
}

async function createProctor({ full_name, email, password_hash }) {
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'proctor', 1)
     RETURNING id, full_name, email, role, status`,
    [full_name, email, password_hash]
  );
  return result.rows[0];
}

async function validateLogin(email, password) {
  const user = await findByEmail(email);
  if (!user) {
    throw new Error("Người dùng không tồn tại");
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    throw new Error("Mật khẩu không đúng");
  }

  // Kiểm tra trạng thái tài khoản
  if (user.status === 0) {
    throw new Error("Tài khoản chưa được kích hoạt. Vui lòng liên hệ quản trị viên");
  }

  return user;
}

async function generateToken(user) {
  // Parse role từ database (có thể là string hoặc JSON array)
  let roles;
  try {
    roles = JSON.parse(user.role);
  } catch (e) {
    roles = [user.role];
  }
  
  return jwt.sign(
    { 
      id: user.id, 
      role: roles, // Lưu roles array vào JWT
      status: user.status,
      full_name: user.full_name,
      email: user.email
    }, 
    SECRET, 
    { expiresIn: "1d" }
  );
}

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function checkEmailExists(email) {
  const user = await findByEmail(email);
  return !!user;
}

async function getUserById(id) {
  const result = await pool.query(
    "SELECT id, full_name, email, role, status, created_at FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
}

async function updateUserStatus(id, status) {
  const result = await pool.query(
    "UPDATE users SET status = $1 WHERE id = $2 RETURNING id, full_name, email, role, status",
    [status, id]
  );
  return result.rows[0] || null;
}

async function changeUserRole(id, role) {
  const result = await pool.query(
    "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, full_name, email, role, status",
    [role, id]
  );
  return result.rows[0] || null;
}

module.exports = {
  findByEmail,
  createStudent,
  createTeacherPending,
  createProctor,
  validateLogin,
  generateToken,
  hashPassword,
  checkEmailExists,
  getUserById,
  updateUserStatus,
  changeUserRole,
};
