const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ message: "No token" });

  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET); 
    req.user = payload;
    next();
  } catch (err) {
    console.error("JWT verify error:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

module.exports = { requireAuth, allowRoles };
