const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");

const {
  createTask,
  getTasks,
} = require("../controllers/task.controller");

router.post("/", auth, createTask);
router.get("/", auth, getTasks);

module.exports = router;
