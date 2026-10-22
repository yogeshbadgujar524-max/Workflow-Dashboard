const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  startWorkSession,
  getCurrentWorkSession,
  startBreak,
  resumeWorkSession,
  stopWorkSession,
  getAllWorkSessions,
} = require("../controllers/workSessionController");

// Support either exported middleware style used by your project.
const protect = authMiddleware.protect || authMiddleware;

// Start tracking a project.
router.post("/start", protect, startWorkSession);

// Restore the current employee's active session.
router.get("/current", protect, getCurrentWorkSession);

// Pause work for a break.
router.post("/:id/break", protect, startBreak);

// Resume work after a break.
router.post("/:id/resume", protect, resumeWorkSession);

// Stop the work timer.
router.post("/:id/stop", protect, stopWorkSession);

// Retrieve all sessions (controller checks admin role).
router.get("/admin", protect, getAllWorkSessions);

module.exports = router;
