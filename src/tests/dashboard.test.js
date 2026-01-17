const prisma = require("../config/prisma");
const logger = require("../utils/logger");

exports.getOverview = async (req, res) => {
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

  // 🔑 USER vs ADMIN scoping
  const baseWhere = {};
  if (req.userRole === "USER") {
    baseWhere.userId = req.userId;
  }

  const totalTasks = await prisma.task.count({
    where: baseWhere,
  });

  const completedTasks = await prisma.task.count({
    where: {
      ...baseWhere,
      status: "COMPLETED",
    },
  });

  const overdueTasks = await prisma.task.count({
    where: {
      ...baseWhere,
      status: { not: "COMPLETED" },
      deadline: { lt: now },
    },
  });

  const completedInRange = startDate
    ? await prisma.task.count({
        where: {
          ...baseWhere,
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
          ...baseWhere,
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

  // ⏱ Average completion time
  const completedTasksWithTime = await prisma.task.findMany({
    where: {
      ...baseWhere,
      status: "COMPLETED",
    },
    select: {
      createdAt: true,
      updatedAt: true,
    },
  });

  let avgCompletionTime = null;

  if (completedTasksWithTime.length > 0) {
    const totalTime = completedTasksWithTime.reduce((sum, task) => {
      return sum + (task.updatedAt - task.createdAt);
    }, 0);

    avgCompletionTime = Math.round(
      totalTime / completedTasksWithTime.length / (1000 * 60)
    ); // minutes
  }

  // 🔢 Most common priority
  const priorities = await prisma.task.groupBy({
    by: ["priority"],
    where: baseWhere,
    _count: true,
    orderBy: {
      _count: {
        priority: "desc",
      },
    },
  });

  const mostCommonPriority =
    priorities.length > 0 ? priorities[0].priority : null;

  // 📈 Productivity trend (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const trend = await prisma.task.groupBy({
    by: ["createdAt"],
    where: {
      ...baseWhere,
      status: "COMPLETED",
      updatedAt: { gte: sevenDaysAgo },
    },
    _count: true,
  });

  logger.info(
    `Dashboard accessed by ${req.userRole} ${
      req.userRole === "USER" ? req.userId : ""
    }`
  );

  res.json({
    scope: req.userRole === "ADMIN" ? "SYSTEM" : "USER",
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

    avgCompletionTimeMinutes: avgCompletionTime,
    mostCommonPriority,
    productivityTrendLast7Days: trend.length,
  });
};
