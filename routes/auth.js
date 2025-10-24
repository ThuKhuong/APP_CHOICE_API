const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { registerStudent, login, getProfile } = require("../controllers/authController");

const router = express.Router();

router.post("/register", registerStudent);
router.post("/login", login);
router.get("/profile", requireAuth, getProfile);

module.exports = router;
