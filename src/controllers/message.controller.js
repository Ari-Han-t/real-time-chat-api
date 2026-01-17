const prisma = require("../config/prisma");
const logger = require("../utils/logger");

exports.sendMessage = async (req, res) => {
    const { receiverId, content } = req.body;
  
    if (!receiverId || !content) {
      return res.status(400).json({ message: "receiverId and content required" });
    }
  
    const receiver = await prisma.user.findUnique({
      where: { id: Number(receiverId) },
    });
  
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }
  
    const message = await prisma.message.create({
      data: {
        senderId: req.userId,
        receiverId: Number(receiverId),
        content,
      },
    });
  
    logger.info(`Message sent from ${req.userId} to ${receiverId}`);
  
    res.status(201).json(message);
  };
  
exports.getConversation = async (req, res) => {
  const otherUserId = parseInt(req.params.userId);

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: req.userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: req.userId },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  res.json(messages);
};
