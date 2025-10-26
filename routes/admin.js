const express = require("express");
const { requireAuth, allowRoles } = require("../middleware/auth");
const adminController = require("../controllers/adminController");

const router = express.Router();

// Auth guard for all admin routes
router.use(requireAuth);

// PROCTOR MANAGEMENT - Removed unused routes

// USER MANAGEMENT
router.get("/users", allowRoles("admin"), adminController.listUsers);
router.get("/pending-teachers", allowRoles("admin"), adminController.listPendingTeachers);
router.put("/approve-teacher/:id", allowRoles("admin"), adminController.approveTeacher);
router.put("/users/:id/role", allowRoles("admin"), adminController.updateUserRole);
router.put("/users/:id/status", allowRoles("admin"), adminController.updateUserStatus);
router.post("/users", allowRoles("admin"), adminController.createUser);

// DASHBOARD
router.get("/dashboard", allowRoles("admin"), adminController.dashboard);
router.get("/exams", allowRoles("admin"), adminController.getAllExams);

module.exports = router;
