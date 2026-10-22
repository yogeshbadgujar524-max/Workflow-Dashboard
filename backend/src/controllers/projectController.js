
const Project = require("../models/Projects");
const User = require("../models/User");
const fs = require("fs/promises");
const path = require("path");

const uploadDir = path.join(__dirname, "../../uploads");

const Notification = require("../models/Notification"); 

// Build attachment metadata from Multer's uploaded file.
const getAttachment = (file) => {
  if (!file) return undefined;

  return {
    originalName: file.originalname,
    filename: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    uploadedAt: new Date(),
  };
};

// Remove an uploaded file from disk.
const removeUploadedFile = async (file) => {
  if (!file?.filename) return;

  const filePath = path.join(uploadDir, path.basename(file.filename));

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to remove uploaded file:", error);
    }
  }
};

const removeStoredAttachment = async (attachment) => {
  if (!attachment?.filename) return;
  await removeUploadedFile({ filename: attachment.filename });
};


// CREATE PROJECT
const createProject = async (req, res) => {
  try {
    console.log("Uploaded file:", req.file || "No file received");

    const attachment = getAttachment(req.file);

    const project = await Project.create({
      ...req.body,
      owner: req.user.userId,
      ...(attachment && { attachment }),
    });

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {
    await removeUploadedFile(req.file);

    console.error("Create project error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create project",
    });
  }
};


// GET ALL PROJECTS FOR CURRENT USER
const getProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { assignedTo: req.user.userId },
        {
          owner: req.user.userId,
          assignedTo: { $exists: false },
        },
      ],
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: projects.length,
      data: projects,
    });
  } catch (error) {
    console.error("Get projects error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
    });
  }
};

// GET SINGLE PROJECT — OWNER ONLY
const getProject = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.userId,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    console.error("Get project error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch project",
    });
  }
};

// UPDATE PROJECT — OWNER ONLY
const updateProject = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.userId,
    });

    if (!project) {
      await removeUploadedFile(req.file);

      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const allowedFields = [
      "name",
      "description",
      "status",
      "priority",
      "startDate",
      "dueDate",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        project[field] = req.body[field];
      }
    }

    const newAttachment = getAttachment(req.file);
    const oldAttachment = project.attachment;

    if (newAttachment) {
      project.attachment = newAttachment;
    }

    try {
      await project.save();
    } catch (error) {
      await removeUploadedFile(req.file);
      throw error;
    }

    // Delete the previous file only after the updated document saves.
    if (newAttachment && oldAttachment?.filename) {
      await removeStoredAttachment(oldAttachment);
    }

    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: project,
    });
  } catch (error) {
    if (error.name === "CastError") {
      await removeUploadedFile(req.file);

      return res.status(400).json({
        success: false,
        message: "Invalid project data or ID",
      });
    }

    if (error.name === "ValidationError") {
      await removeUploadedFile(req.file);

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Update project error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update project",
    });
  }
};

// DELETE PROJECT — OWNER ONLY
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      owner: req.user.userId,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    try {
      await removeStoredAttachment(project.attachment);
    } catch (error) {
      console.error("Attachment cleanup error:", error);
    }

    return res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    console.error("Delete project error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete project",
    });
  }
};



// CREATE PROJECT FROM ADMIN PANEL
const createAdminProject = async (req, res) => {
  try {
    // 1. Get and normalize assigned user's email
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      await removeUploadedFile(req.file);

      return res.status(400).json({
        success: false,
        message: "Assigned user's email is required",
      });
    }

    // 2. Find registered employee
    const assignedUser = await User.findOne({ email });

    if (!assignedUser) {
      await removeUploadedFile(req.file);

      return res.status(404).json({
        success: false,
        message: "No registered user found with this email",
      });
    }

    // 3. Prepare attachment and project fields
    const attachment = getAttachment(req.file);

    const {
      email: _email,
      ...projectFields
    } = req.body;

    // 4. Create project and assign it to employee
    const project = await Project.create({
      ...projectFields,
      owner: req.user.userId,
      assignedTo: assignedUser._id,
      assignedEmail: assignedUser.email,
      ...(attachment && { attachment }),
    });

    // 5. Save notification in MongoDB and emit real-time event
    try {
      const notification = await Notification.create({
        recipient: assignedUser._id,
        type: "project_assigned",
        title: "New project assigned",
        message: `You have been assigned to "${project.name}".`,
        project: project._id,
      });

      // Socket.IO instance must be configured on the Express app
      const io = req.app.get("io");

      if (io) {
        io.to(`user:${assignedUser._id.toString()}`).emit(
          "notification:new",
          notification
        );
      } else {
        console.warn(
          "Socket.IO instance not found. Notification was saved, but not emitted."
        );
      }
    } catch (notificationError) {
      console.error(
        "Project created, but notification failed:",
        notificationError
      );
    }

    // 6. Return successful response
    return res.status(201).json({
      success: true,
      message: "Project assigned and created successfully",
      data: project,
    });
  } catch (error) {
    await removeUploadedFile(req.file);

    console.error("Admin create project error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create assigned project",
    });
  }
};


module.exports = {
  createAdminProject,
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
};