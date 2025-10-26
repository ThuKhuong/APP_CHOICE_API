const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers["authorization"];
  
  if (!header) {
    return res.status(401).json({ message: "Không có token xác thực" });
  }

  const token = header.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ message: "Token không hợp lệ" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "secret123"); 
    
    // Parse role từ JSON string nếu cần
    if (typeof payload.role === 'string' && payload.role.startsWith('[')) {
      try {
        payload.role = JSON.parse(payload.role);
      } catch (e) {
        // Nếu không parse được, giữ nguyên
      }
    }
    
    req.user = payload;
    next();
  } catch (err) {
    console.error("Backend - JWT verify error:", err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Token đã hết hạn" });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Token không hợp lệ" });
    }
    return res.status(401).json({ message: "Lỗi xác thực token" });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Chưa xác thực" });
    }

    // Hỗ trợ multi-role: kiểm tra user có role nào trong danh sách allowed roles
    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const hasAccess = userRoles.some(role => roles.includes(role));
    
    if (!hasAccess) {
      return res.status(403).json({ 
        message: `Bạn không có quyền truy cập. Yêu cầu role: ${roles.join(', ')}` 
      });
    }

    // Kiểm tra trạng thái tài khoản
    if (req.user.status === 0) {
      return res.status(403).json({ 
        message: "Tài khoản chưa được kích hoạt. Vui lòng liên hệ quản trị viên" 
      });
    }

    next();
  };
}

function requireActiveAccount(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Chưa xác thực" });
  }

  if (req.user.status === 0) {
    return res.status(403).json({ 
      message: "Tài khoản chưa được kích hoạt. Vui lòng liên hệ quản trị viên" 
    });
  }

  next();
}

function checkRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Chưa xác thực" });
    }

    // Hỗ trợ multi-role: kiểm tra user có role được yêu cầu không
    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const hasAccess = userRoles.includes(role);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        message: `Yêu cầu role ${role}. Role hiện tại: ${userRoles.join(', ')}` 
      });
    }

    // Kiểm tra trạng thái tài khoản
    if (req.user.status === 0) {
      return res.status(403).json({ 
        message: "Tài khoản chưa được kích hoạt. Vui lòng liên hệ quản trị viên" 
      });
    }

    next();
  };
}

module.exports = { 
  requireAuth, 
  allowRoles, 
  requireActiveAccount, 
  checkRole 
};
