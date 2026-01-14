const prisma = require("../config/prisma");

exports.createTask = async (req, res) => {
  const { title, description, priority, deadline } = req.body;

  if (!title || !priority || !deadline) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      priority,
      deadline: new Date(deadline),
      userId: req.userId,
    },
  });

  res.status(201).json(task);
};

exports.getTasks = async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
  });

  res.json(tasks);
};
