const User = require("../models/User");
const Project = require("../models/Projects");

const path = require("path");
const fs = require("fs/promises");

// ========================================
// GET ALL USERS
// ========================================

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

// ========================================
// GET ALL PROJECTS
// ========================================

const getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate("owner", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: projects.length,
      data: projects,
    });
  } catch (error) {
    console.error("Get admin projects error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin projects",
    });
  }
};

// ========================================
// GET ADMIN DASHBOARD STATS
// ========================================

const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();

    const totalProjects = await Project.countDocuments();

    const activeProjects = await Project.countDocuments({
      status: "active",
    });

    const completedProjects = await Project.countDocuments({
      status: "completed",
    });

    const planningProjects = await Project.countDocuments({
      status: "planning",
    });

    const onHoldProjects = await Project.countDocuments({
      status: "on-hold",
    });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalProjects,
        activeProjects,
        completedProjects,
        planningProjects,
        onHoldProjects,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch admin statistics",
      error: error.message,
    });
  }
};


// UPDATE USER ROLE
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be user or admin",
      });
    }

    if (id === String(req.user.userId) && role !== "admin") {
      return res.status(400).json({
        success: false,
        message: "You cannot remove your own admin role",
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update user role",
    });
  }
};


// DELETE USER
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === String(req.user.userId)) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};


// UPDATE PROJECT
const updateAdminProject = async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow editable project fields.
    const allowedFields = [
      "name",
      "description",
      "status",
      "priority",
      "startDate",
      "dueDate",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid project fields provided",
      });
    }

    const project = await Project.findByIdAndUpdate(
      id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    ).populate("owner", "name email role");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: project,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update project",
    });
  }
};

// DELETE PROJECT
const deleteAdminProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findByIdAndDelete(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete project",
    });
  }
};


const downloadAdminProjectAttachment = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const attachment = project.attachment;

    if (!attachment?.filename) {
      return res.status(404).json({
        success: false,
        message: "No attachment found",
      });
    }

    const safeFilename = path.basename(attachment.filename);

    if (safeFilename !== attachment.filename) {
      return res.status(400).json({
        success: false, 
        message: "Invalid attachment filename",
      });
    }

    const uploadDir = path.resolve(__dirname, "../../uploads");
    const filePath = path.join(uploadDir, safeFilename);

    await fs.access(filePath);

    return res.download(filePath, attachment.originalName);
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(404).json({
        success: false,
        message: "Stored attachment file was not found",
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    console.error("Admin attachment download error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to download attachment",
    });
  }
};


module.exports = {
  getAllUsers,
  getAllProjects,
  getAdminStats,
  updateUserRole,
  deleteUser,
  updateAdminProject,
  deleteAdminProject,
  downloadAdminProjectAttachment
};