const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers["authorization"];
  console.log("Backend - Authorization header:", header);
  
  if (!header) {
    console.log("Backend - No authorization header found");
    return res.status(401).json({ message: "Không có token xác thực" });
  }

  const token = header.split(" ")[1];
  console.log("Backend - Extracted token:", token ? `${token.substring(0, 20)}...` : "null");
  
  if (!token) {
    console.log("Backend - No token found in header");
    return res.status(401).json({ message: "Token không hợp lệ" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "secret123"); 
    console.log("Backend - JWT payload:", payload);
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

    if (req.user.role !== role) {
      return res.status(403).json({ 
        message: `Yêu cầu role ${role}. Role hiện tại: ${req.user.role}` 
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
