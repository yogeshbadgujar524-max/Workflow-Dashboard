const express = require("express");

const {
  getAllUsers,
  getAllProjects,
  getAdminStats,
  updateUserRole,
  deleteUser,
  updateAdminProject,
  deleteAdminProject,
  downloadAdminProjectAttachment,
} = require("../controllers/adminController");

const protect = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const { createAdminProject } = require("../controllers/projectController");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

// Get all users
router.get(
  "/users",
  protect,
  adminMiddleware,
  getAllUsers
);

// Get all projects
router.get(
  "/projects",
  protect,
  adminMiddleware,
  getAllProjects
);

router.get(
  "/projects/:id/attachment",
  downloadAdminProjectAttachment
);

// Get dashboard statistics
router.get(
  "/stats",
  protect,
  adminMiddleware,
  getAdminStats
);

// Users CRUD Update and Delete
router.put(
  "/users/:id/role",
  protect,
  adminMiddleware,
  updateUserRole
);

router.delete(
  "/users/:id",
  protect,
  adminMiddleware,
  deleteUser
);

// Projects Update & Delete 
router.put(
  "/projects/:id",
  protect,
  adminMiddleware,
  updateAdminProject
);

router.delete(
  "/projects/:id",
  protect,
  adminMiddleware,
  deleteAdminProject
);


// Create and assign a project from the admin panel
router.post(
  "/projects",
  protect,
  adminMiddleware,
  upload.single("file"),
  createAdminProject
);



module.exports = router;