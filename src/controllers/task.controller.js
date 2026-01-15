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
  const { status, priority, search, from, to } = req.query;

  const filters = {
    userId: req.userId,
  };

  // Filter by status
  if (status) {
    filters.status = status;
  }

  // Filter by priority
  if (priority) {
    filters.priority = priority;
  }

  // Search in title or description
  if (search) {
    filters.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
    ];
  }

  // Deadline range filter
  if (from || to) {
    filters.deadline = {};
    if (from) filters.deadline.gte = new Date(from);
    if (to) filters.deadline.lte = new Date(to);
  }

  const tasks = await prisma.task.findMany({
    where: filters,
    orderBy: { createdAt: "desc" },
  });

  res.json(tasks);
};


exports.updateTask = async (req, res) => {
    const taskId = parseInt(req.params.id);
    const { title, description, priority, status, deadline } = req.body;
  
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: req.userId,
      },
    });
  
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
  
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        title,
        description,
        priority,
        status,
        deadline: deadline ? new Date(deadline) : undefined,
      },
    });
  
    res.json(updatedTask);
  };
  
  exports.deleteTask = async (req, res) => {
    const taskId = parseInt(req.params.id);
  
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        userId: req.userId,
      },
    });
  
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
  
    await prisma.task.delete({
      where: { id: taskId },
    });
  
    res.json({ message: "Task deleted successfully" });
  };
  
