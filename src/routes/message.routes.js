const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { messageLimiter } = require("../middleware/rateLimit.middleware");

const {
  sendMessage,
  getConversation,
  editMessage,
  deleteMessage,
} = require("../controllers/message.controller");

router.post("/", auth, messageLimiter, sendMessage);
router.get("/:userId", auth, getConversation);
router.put("/:id", auth, editMessage);
router.delete("/:id", auth, deleteMessage);

module.exports = router;
