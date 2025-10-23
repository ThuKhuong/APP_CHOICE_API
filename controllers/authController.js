const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User");

const SECRET = process.env.JWT_SECRET || "secret123";

async function registerStudent(req, res) {
  const { full_name, email, password } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ message: "Thiếu thông tin" });
  }
  try {
    const existing = await User.findByEmail(email);
    if (existing) return res.status(400).json({ message: "Email đã được sử dụng" });
    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.createStudent({ full_name, email, password_hash });
    const token = jwt.sign({ id: user.id, role: user.role, status: user.status }, SECRET, { expiresIn: "1d" });
    res.status(201).json({ message: "Đăng ký thành công", token, user });
  } catch (err) {
    console.error("Lỗi đăng ký:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  try {
    const user = await User.findByEmail(email);
    if (!user) return res.status(400).json({ message: "Người dùng không tồn tại" });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ message: "Mật khẩu không đúng" });
    const token = jwt.sign({ id: user.id, role: user.role, status: user.status }, SECRET, { expiresIn: "1d" });
    res.json({ token, user: { id: user.id, full_name: user.full_name, role: user.role, status: user.status } });
  } catch (err) {
    console.error("Lỗi login:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

module.exports = { registerStudent, login };


