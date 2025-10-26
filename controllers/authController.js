const Auth = require("../models/Auth");


function parseUserRoles(role) {
  try {
    // Thử parse role như JSON array
    return JSON.parse(role);
  } catch (e) {
    // Nếu không parse được, role là string
    return [role];
  }
}

exports.registerStudent = async function(req, res) {
  const { full_name, email, password } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ message: "Thiếu thông tin" });
  }
  
  try {
    const emailExists = await Auth.checkEmailExists(email);
    if (emailExists) {
      return res.status(400).json({ message: "Email đã được sử dụng" });
    }
    
    const password_hash = await Auth.hashPassword(password);
    const user = await Auth.createStudent({ full_name, email, password_hash });
    const token = await Auth.generateToken(user);
    
    res.status(201).json({ 
      message: "Đăng ký thành công", 
      token, 
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    console.error("Lỗi đăng ký:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.registerTeacher = async function(req, res) {
  const { full_name, email, password } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ message: "Thiếu thông tin" });
  }
  
  try {
    const emailExists = await Auth.checkEmailExists(email);
    if (emailExists) {
      return res.status(400).json({ message: "Email đã được sử dụng" });
    }
    
    const password_hash = await Auth.hashPassword(password);
    const user = await Auth.createTeacherPending({ full_name, email, password_hash });
    
    res.status(201).json({ 
      message: "Đăng ký thành công! Tài khoản đang chờ quản trị viên duyệt.", 
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    console.error("Lỗi đăng ký:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.login = async function(req, res) {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: "Vui lòng nhập email và mật khẩu" });
  }
  
  try {
    const user = await Auth.validateLogin(email, password);
    
    // Hỗ trợ multi-role: xử lý role có thể là string hoặc JSON array
    const roles = parseUserRoles(user.role);
    
    // Tạo token với role đã parse
    const token = jwt.sign(
      { id: user.id, email: user.email, role: roles, status: user.status },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "24h" }
    );
    
    res.json({ 
      message: "Đăng nhập thành công",
      token, 
      user: { 
        id: user.id, 
        full_name: user.full_name, 
        email: user.email, 
        role: roles,
        status: user.status 
      }
    });
  } catch (err) {
    console.error("Lỗi login:", err.message);
    
    // Trả về thông báo lỗi cụ thể
    if (err.message === "Người dùng không tồn tại") {
      return res.status(404).json({ message: err.message });
    }
    if (err.message === "Mật khẩu không đúng") {
      return res.status(401).json({ message: err.message });
    }
    if (err.message === "Tài khoản chưa được kích hoạt. Vui lòng liên hệ quản trị viên") {
      return res.status(403).json({ message: err.message });
    }
    
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.getProfile = async function(req, res) {
  try {
    const user = await Auth.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy thông tin người dùng" });
    }
    
    res.json({
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status,
        created_at: user.created_at
      }
    });
  } catch (err) {
    console.error("Lỗi lấy thông tin profile:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};


