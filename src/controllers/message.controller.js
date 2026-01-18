const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const { getIO } = require("../socket");


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
    
    const io = getIO();
    io.to(`user:${receiverId}`).emit("receive_message", message);
  
    logger.info(`Message sent from ${req.userId} to ${receiverId}`);
  
    res.status(201).json(message);
  };
  
  
  exports.getConversation = async (req, res) => {
    const otherUserId = Number(req.params.userId);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
  
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: req.userId },
        ],
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });
  
    const totalMessages = await prisma.message.count({
      where: {
        OR: [
          { senderId: req.userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: req.userId },
        ],
      },
    });
  
    res.json({
      page,
      limit,
      totalMessages,
      totalPages: Math.ceil(totalMessages / limit),
      messages: messages.reverse(), // chronological order
    });
  };
  