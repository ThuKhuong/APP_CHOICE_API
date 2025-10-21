const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt"); // thêm bcrypt
const pool = require("../db");

const router = express.Router();
const SECRET = "secret123"; //  .env

// Đăng ký sinh viên
router.post("/register", async (req, res) => {
  const { full_name, email, password } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ message: "Thiếu thông tin" });
  }

  try {
    // Kiểm tra email trùng
    const existing = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Email đã được sử dụng" });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);
    // Thêm tài khoản sinh viên
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'student')
       RETURNING id, full_name, email, role`,
      [full_name, email, hashedPassword]
    );

    const user = result.rows[0];
    // Tạo token đăng nhập ngay sau khi đăng ký
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: "2h" });

    res.status(201).json({ message: "Đăng ký thành công", token, user });
  } catch (err) {
    console.error("Lỗi đăng ký:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Người dùng không tồn tại" });
    }

    const user = result.rows[0];

    // So sánh mật khẩu nhập vào với hash trong DB
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ message: "Mật khẩu không đúng" });
    }

    // Tạo JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Lỗi login:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
