const express = require("express");

const { registerUser, loginUser, getCurrentUser, getRegisterUsers } = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);

router.post("/login", loginUser);

router.get("/register",getRegisterUsers);

router.get("/me", protect, getCurrentUser);

module.exports = router;