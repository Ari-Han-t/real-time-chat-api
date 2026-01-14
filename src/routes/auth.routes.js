const express = require("express");
const router = express.Router();

const users = []; // TEMP memory storage

router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  users.push({ email, password });
  res.status(201).json({ message: "User registered (temporary)" });
});

router.post("/login", (req, res) => {
  res.json({ message: "Login endpoint (next step)" });
});

module.exports = router;
