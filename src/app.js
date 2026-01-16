const express = require("express");

const app = express();

// ✅ THIS LINE IS CRITICAL
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Backend is running" });
});

const authRoutes = require("./routes/auth.routes");
const taskRoutes = require("./routes/task.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

app.use("/auth", authRoutes);
app.use("/tasks", taskRoutes);
app.use("/dashboard", dashboardRoutes);

module.exports = app;
