const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const multer = require("multer");
require("dotenv").config();

const Timer = require("./routes/workSessionRoutes");

const connectDB = require("./config/db");

const projectRoutes = require("./routes/projectRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes"); 

const app = express();
const httpServer = http.createServer(app);

const allowedOrigin =
  process.env.FRONTEND_URL || "http://localhost:3000";

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/notifications", notificationRoutes);


// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST", "PATCH"],
    credentials: true,
  },
});

// Authenticate socket connections using the existing JWT
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id || decoded._id;

    if (!userId) {
      return next(new Error("Invalid authentication token"));
    }

    socket.data.userId = String(userId);
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
});

// Every authenticated user joins their own private room
io.on("connection", (socket) => {
  const room = `user:${socket.data.userId}`;

  socket.join(room);

  console.log(`User connected to notifications: ${socket.data.userId}`);

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.data.userId}`);
  });
});

// Make Socket.IO available to Express controllers
app.set("io", io);

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/admin", adminRoutes);

app.use("/api/work-sessions", Timer);

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "WorkFlow Manager API is running",
  });
});

// Error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File size must be 5 MB or less."
        : "The uploaded file could not be accepted.";

    return res.status(400).json({
      success: false,
      message,
    });
  }

  if ( 
    err.message === "Only PDF, PNG, JPG, and DOCX files are allowed.") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  console.error(err);

  return res.status(500).json({
    success: false,
    message: "Something went wrong on the server.",
  });
});

const PORT = process.env.PORT || 5000;

connectDB();

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
