
const express = require("express");
const router = express.Router();

const {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
} = require("../controllers/projectController");

const authMiddleware = require("../middleware/authMiddleware");
const protect = authMiddleware.protect || authMiddleware;

const upload = require("../middleware/uploadMiddleware");

// Verify imports before registering routes.
console.log("Route handler checks:", {
  protect: typeof protect,
  uploadSingle: typeof upload?.single,
  createProject: typeof createProject,
  getProjects: typeof getProjects,
  getProject: typeof getProject,
  updateProject: typeof updateProject,
  deleteProject: typeof deleteProject,
});

router.post(
  "/",
  protect,
  upload.single("file"),
  createProject
);

router.get("/", protect, getProjects);
router.get("/:id", protect, getProject);

router.put(
  "/:id",
  protect,
  upload.single("file"),
  updateProject
);

router.delete("/:id", protect, deleteProject);

module.exports = router;