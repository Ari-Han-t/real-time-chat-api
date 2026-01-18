const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/auth.controller");
const { authLimiter } = require("../middleware/rateLimit.middleware");
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);

module.exports = router;
