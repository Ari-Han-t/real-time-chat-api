const prisma = require("../config/prisma");

exports.getOverview = async (req, res) => {
  const userId = req.userId;
  const now = new Date();

  const totalTasks = await prisma.task.count({
    where: { userId },
  });

  const completedTasks = await prisma.task.count({
    where: {
      userId,
      status: "COMPLETED",
    },
  });

  const overdueTasks = await prisma.task.count({
    where: {
      userId,
      status: { not: "COMPLETED" },
      deadline: { lt: now },
    },
  });

  const completionRate =
    totalTasks === 0
      ? 0
      : Math.round((completedTasks / totalTasks) * 100);

  res.json({
    totalTasks,
    completedTasks,
    overdueTasks,
    completionRate,
  });
};
