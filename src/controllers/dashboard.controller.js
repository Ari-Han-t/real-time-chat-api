const prisma = require("../config/prisma");

exports.getOverview = async (req, res) => {
  const userId = req.userId;
  const { range, from, to } = req.query;

  const now = new Date();
  let startDate = null;
  let endDate = now;

  if (range === "day") {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  } else if (range === "month") {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
  } else if (from || to) {
    startDate = from ? new Date(from) : null;
    endDate = to ? new Date(to) : now;
  }

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

  const completedInRange = startDate
    ? await prisma.task.count({
        where: {
          userId,
          status: "COMPLETED",
          updatedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      })
    : null;

  const totalInRange = startDate
    ? await prisma.task.count({
        where: {
          userId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      })
    : null;

  const completionRateInRange =
    startDate && totalInRange > 0
      ? Math.round((completedInRange / totalInRange) * 100)
      : null;

  res.json({
    totalTasks,
    completedTasks,
    overdueTasks,
    completionRateAllTime:
      totalTasks === 0
        ? 0
        : Math.round((completedTasks / totalTasks) * 100),

    range: range || (from || to ? "custom" : "all"),
    completedInRange,
    totalInRange,
    completionRateInRange,
  });
};
