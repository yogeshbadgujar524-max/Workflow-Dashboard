
const mongoose = require("mongoose");
const WorkSession = require("../models/WorkSession");
const Project = require("../models/Projects");

// Check whether the logged-in employee can access this project.
const canAccessProject = (project, userId) => {
  const assignedTo = project.assignedTo?.toString();

  const isAssignedEmployee = assignedTo === userId;

  const isMember = project.members?.some(
    (member) => member.toString() === userId
  );

  return isAssignedEmployee || isMember;
};

// Calculate actual work time, excluding breaks.
const calculateWorkSeconds = (session, stoppedAt) => {
  const startTime = new Date(session.startedAt).getTime();
  const endTime = new Date(stoppedAt).getTime();

  let totalSeconds = Math.floor((endTime - startTime) / 1000);

  for (const breakItem of session.breaks) {
    const breakStart = new Date(breakItem.startedAt).getTime();

    // If the session stopped during a break, use stoppedAt
    // as the effective end of that break.
    const breakEnd = breakItem.endedAt
      ? new Date(breakItem.endedAt).getTime()
      : endTime;

    totalSeconds -= Math.floor((breakEnd - breakStart) / 1000);
  }

  return Math.max(0, totalSeconds);
};

// START WORK SESSION
exports.startWorkSession = async (req, res) => {
  try {
    const { projectId } = req.body;
    const employeeId = req.user.userId;

    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({
        message: "A valid project ID is required.",
      });
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({
        message: "Project not found.",
      });
    }

    if (!canAccessProject(project, employeeId)) {
      return res.status(403).json({
        message: "You are not assigned to this project.",
      });
    }

    if (project.status === "completed") {
      return res.status(400).json({
        message: "A completed project cannot be started.",
      });
    }

    // Only one running or paused session per employee.
    const existingSession = await WorkSession.findOne({
      employee: employeeId,
      status: { $in: ["running", "on_break"] },
    });

    if (existingSession) {
      return res.status(409).json({
        message: "You already have an active work session.",
        session: existingSession,
      });
    }

    const session = await WorkSession.create({
      employee: employeeId,
      project: project._id,
      startedAt: new Date(),
      status: "running",
    });

    return res.status(201).json({
      message: "Work session started successfully.",
      session,
    });
  } catch (error) {
    console.error("Start work session error:", error);

    return res.status(500).json({
      message: "Unable to start work session.",
    });
  }
};

// GET CURRENT EMPLOYEE SESSION
exports.getCurrentWorkSession = async (req, res) => {
  try {
    const session = await WorkSession.findOne({
      employee: req.user.userId,
      status: { $in: ["running", "on_break"] },
    })
      .sort({ startedAt: -1 })
      .populate("project", "name description status priority startDate dueDate");

    return res.status(200).json({
      session: session || null,
    });
  } catch (error) {
    console.error("Get current work session error:", error);

    return res.status(500).json({
      message: "Unable to fetch current work session.",
    });
  }
};

// START BREAK
exports.startBreak = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid work session ID.",
      });
    }

    const session = await WorkSession.findOne({
      _id: req.params.id,
      employee: req.user.userId,
    });

    if (!session) {
      return res.status(404).json({
        message: "Work session not found.",
      });
    }

    if (session.status !== "running") {
      return res.status(400).json({
        message: "Only a running session can be paused.",
      });
    }

    session.breaks.push({
      startedAt: new Date(),
      endedAt: null,
    });

    session.status = "on_break";

    await session.save();

    return res.status(200).json({
      message: "Break started.",
      session,
    });
  } catch (error) {
    console.error("Start break error:", error);

    return res.status(500).json({
      message: "Unable to start break.",
    });
  }
};

// RESUME WORK
exports.resumeWorkSession = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid work session ID.",
      });
    }

    const session = await WorkSession.findOne({
      _id: req.params.id,
      employee: req.user.userId,
    });

    if (!session) {
      return res.status(404).json({
        message: "Work session not found.",
      });
    }

    if (session.status !== "on_break") {
      return res.status(400).json({
        message: "This session is not on a break.",
      });
    }

    const currentBreak = session.breaks[session.breaks.length - 1];

    if (!currentBreak || currentBreak.endedAt) {
      return res.status(400).json({
        message: "No open break was found.",
      });
    }

    currentBreak.endedAt = new Date();
    session.status = "running";

    await session.save();

    return res.status(200).json({
      message: "Work resumed successfully.",
      session,
    });
  } catch (error) {
    console.error("Resume work session error:", error);

    return res.status(500).json({
      message: "Unable to resume work session.",
    });
  }
};

// STOP WORK SESSION
exports.stopWorkSession = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid work session ID.",
      });
    }

    const session = await WorkSession.findOne({
      _id: req.params.id,
      employee: req.user.userId,
    });

    if (!session) {
      return res.status(404).json({
        message: "Work session not found.",
      });
    }

    if (session.status === "stopped") {
      return res.status(400).json({
        message: "This session has already been stopped.",
      });
    }

    const stoppedAt = new Date();

    // If stopping during a break, close the break first.
    if (session.status === "on_break") {
      const currentBreak = session.breaks[session.breaks.length - 1];

      if (currentBreak && !currentBreak.endedAt) {
        currentBreak.endedAt = stoppedAt;
      }
    }

    session.endedAt = stoppedAt;
    session.status = "stopped";
    session.totalWorkSeconds = calculateWorkSeconds(
      session,
      stoppedAt
    );

    await session.save();

    return res.status(200).json({
      message: "Work session stopped successfully.",
      session,
    });
  } catch (error) {
    console.error("Stop work session error:", error);

    return res.status(500).json({
      message: "Unable to stop work session.",
    });
  }
};

// ADMIN: GET ALL WORK SESSIONS
exports.getAllWorkSessions = async (req, res) => {
  try {
    // Confirm that this matches your User model and JWT middleware.
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Admin access is required.",
      });
    }

    const sessions = await WorkSession.find()
      .sort({ startedAt: -1 })
      .populate("employee", "name email")
      .populate("project", "name status priority");

    return res.status(200).json({
      count: sessions.length,
      sessions,
    });
  } catch (error) {
    console.error("Get all work sessions error:", error);

    return res.status(500).json({
      message: "Unable to fetch work sessions.",
    });
  }
};
