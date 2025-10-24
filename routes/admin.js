const express = require("express");
const { requireAuth, allowRoles } = require("../middleware/auth");
const adminController = require("../controllers/adminController");

const router = express.Router();

// Auth guard for all admin routes
router.use(requireAuth);

// PROCTOR MANAGEMENT
router.post("/proctors", allowRoles("admin"), adminController.createProctor);
router.get("/proctors", allowRoles("admin"), adminController.listProctors);
router.get("/proctors/:proctorId", allowRoles("admin"), adminController.getProctorDetails);
router.put("/proctors/:proctorId/status", allowRoles("admin"), adminController.updateProctorStatus);
router.put("/proctors/:proctorId/role", allowRoles("admin"), adminController.changeProctorRole);

// USER MANAGEMENT
router.get("/users", allowRoles("admin"), adminController.listUsers);
router.get("/pending-teachers", allowRoles("admin"), adminController.listPendingTeachers);
router.put("/approve-teacher/:id", allowRoles("admin"), adminController.approveTeacher);
router.put("/users/:id/role", allowRoles("admin"), adminController.updateUserRole);
router.put("/users/:id/status", allowRoles("admin"), adminController.updateUserStatus);

// DASHBOARD
router.get("/dashboard", allowRoles("admin"), adminController.dashboard);

module.exports = router;
