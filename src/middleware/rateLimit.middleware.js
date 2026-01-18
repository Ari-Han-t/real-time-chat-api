const rateLimit = require("express-rate-limit");

// 🔐 Auth endpoints (login/register)
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per IP
  message: {
    message: "Too many authentication attempts. Please try again later.",
  },
});

// 💬 Messaging endpoints
exports.messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: {
    message: "You are sending messages too fast. Slow down.",
  },
});
