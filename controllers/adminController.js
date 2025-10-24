const Auth = require("../models/Auth");
const User = require("../models/User");

async function createProctor(req, res) {
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
    const proctor = await Auth.createProctor({ full_name, email, password_hash });
    
    res.status(201).json({ 
      message: "Tạo tài khoản giám thị thành công", 
      proctor: {
        id: proctor.id,
        full_name: proctor.full_name,
        email: proctor.email,
        role: proctor.role,
        status: proctor.status
      }
    });
  } catch (err) {
    console.error("Lỗi tạo giám thị:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function listProctors(req, res) {
  try {
    const proctors = await User.getAvailableProctors();
    res.json({ proctors });
  } catch (err) {
    console.error("Lỗi lấy danh sách giám thị:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function updateProctorStatus(req, res) {
  const { proctorId } = req.params;
  const { status } = req.body;
  
  if (status === undefined || (status !== 0 && status !== 1)) {
    return res.status(400).json({ message: "Status phải là 0 hoặc 1" });
  }
  
  try {
    const proctor = await Auth.updateUserStatus(proctorId, status);
    if (!proctor) {
      return res.status(404).json({ message: "Không tìm thấy giám thị" });
    }
    
    res.json({ 
      message: `Cập nhật trạng thái giám thị thành công`,
      proctor 
    });
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái giám thị:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function changeProctorRole(req, res) {
  const { proctorId } = req.params;
  const { role } = req.body;
  
  if (!role || !['proctor', 'teacher', 'student'].includes(role)) {
    return res.status(400).json({ message: "Role không hợp lệ" });
  }
  
  try {
    const user = await Auth.changeUserRole(proctorId, role);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    
    res.json({ 
      message: `Thay đổi role thành công`,
      user 
    });
  } catch (err) {
    console.error("Lỗi thay đổi role:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function getProctorDetails(req, res) {
  const { proctorId } = req.params;
  
  try {
    const proctor = await Auth.getUserById(proctorId);
    if (!proctor) {
      return res.status(404).json({ message: "Không tìm thấy giám thị" });
    }
    
    if (!['proctor', 'teacher'].includes(proctor.role)) {
      return res.status(400).json({ message: "Người dùng này không phải là giám thị" });
    }
    
    res.json({ proctor });
  } catch (err) {
    console.error("Lỗi lấy thông tin giám thị:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function listUsers(req, res) {
  try {
    const users = await User.getAllUsers();
    res.json({ users });
  } catch (err) {
    console.error("Lỗi lấy danh sách người dùng:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function listPendingTeachers(req, res) {
  try {
    const pendingTeachers = await User.getPendingTeachers();
    res.json({ pendingTeachers });
  } catch (err) {
    console.error("Lỗi lấy danh sách giáo viên chờ duyệt:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function approveTeacher(req, res) {
  const { id } = req.params;
  
  try {
    const teacher = await Auth.approveTeacher(id);
    if (!teacher) {
      return res.status(404).json({ message: "Không tìm thấy giáo viên" });
    }
    
    res.json({ 
      message: "Duyệt giáo viên thành công",
      teacher 
    });
  } catch (err) {
    console.error("Lỗi duyệt giáo viên:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function updateUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body;
  
  if (!role || !['admin', 'teacher', 'student'].includes(role)) {
    return res.status(400).json({ message: "Role không hợp lệ" });
  }
  
  try {
    const user = await Auth.changeUserRole(id, role);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    
    res.json({ 
      message: "Cập nhật role thành công",
      user 
    });
  } catch (err) {
    console.error("Lỗi cập nhật role:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function updateUserStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  
  if (status === undefined || (status !== 0 && status !== 1)) {
    return res.status(400).json({ message: "Status phải là 0 hoặc 1" });
  }
  
  try {
    const user = await Auth.updateUserStatus(id, status);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    
    res.json({ 
      message: "Cập nhật trạng thái thành công",
      user 
    });
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

async function dashboard(req, res) {
  try {
    const stats = await User.getDashboardStats();
    res.json({ stats });
  } catch (err) {
    console.error("Lỗi lấy thống kê dashboard:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
}

module.exports = {
  createProctor,
  listProctors,
  updateProctorStatus,
  changeProctorRole,
  getProctorDetails,
  listUsers,
  listPendingTeachers,
  approveTeacher,
  updateUserRole,
  updateUserStatus,
  dashboard,
};