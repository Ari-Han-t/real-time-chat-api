const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");

const {
    createTask,
    getTasks,
    updateTask,
  } = require("../controllers/task.controller");
  
router.post("/", auth, createTask);
router.get("/", auth, getTasks);




  router.put("/:id", auth, updateTask);
  
  module.exports = router;