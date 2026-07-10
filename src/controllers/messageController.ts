 import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { sendPushNotification } from '../services/notifications';

// Send a message tied to a service request
export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  const { serviceRequestId, text } = req.body;

  if (!serviceRequestId || !text?.trim()) {
    res.status(400).json({ error: 'serviceRequestId and text are required' });
    return;
  }

  try {
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      include: {
        driver:  { select: { id: true, name: true, pushToken: true } },
        mechanic:{ select: { id: true, name: true, pushToken: true } },
      },
    });

    if (!serviceRequest) {
      res.status(404).json({ error: 'Service request not found' });
      return;
    }

    const isDriver   = serviceRequest.driverId   === req.userId;
    const isMechanic = serviceRequest.mechanicId === req.userId;

    if (!isDriver && !isMechanic) {
      res.status(403).json({ error: 'You are not part of this job' });
      return;
    }

    const message = await prisma.message.create({
      data: {
        text: text.trim(),
        serviceRequestId,
        senderId: req.userId as string,
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });

    // Notify the other party
    const recipient   = isDriver ? serviceRequest.mechanic : serviceRequest.driver;
    const senderName  = isDriver ? serviceRequest.driver.name : serviceRequest.mechanic?.name;

    if (recipient?.pushToken) {
      await sendPushNotification(
        recipient.pushToken,
        `💬 ${senderName}`,
        text.trim(),
        { type: 'NEW_MESSAGE', requestId: serviceRequestId }
      );
    }

    res.status(201).json({ message });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all messages for a service request — paginated
export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  const { serviceRequestId } = req.params;
  const page  = parseInt(req.query.page  as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const skip  = (page - 1) * limit;

  try {
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where:  { id: serviceRequestId },
      select: { driverId: true, mechanicId: true },
    });

    if (!serviceRequest) {
      res.status(404).json({ error: 'Service request not found' });
      return;
    }

    const isDriver   = serviceRequest.driverId   === req.userId;
    const isMechanic = serviceRequest.mechanicId === req.userId;

    if (!isDriver && !isMechanic) {
      res.status(403).json({ error: 'You are not part of this job' });
      return;
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where:   { serviceRequestId },
        include: { sender: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.message.count({ where: { serviceRequestId } }),
    ]);

    // Mark messages from the other party as read
    await prisma.message.updateMany({
      where: {
        serviceRequestId,
        senderId: { not: req.userId },
        read: false,
      },
      data: { read: true },
    });

    res.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + messages.length < total,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get unread message count
export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  const { serviceRequestId } = req.params;

  try {
    const count = await prisma.message.count({
      where: {
        serviceRequestId,
        senderId: { not: req.userId },
        read: false,
      },
    });

    res.json({ unreadCount: count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all chats for the current user across all jobs
export const getMyChats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const serviceRequests = await prisma.serviceRequest.findMany({
      where: {
        OR: [
          { driverId:   req.userId },
          { mechanicId: req.userId },
        ],
        status: { notIn: ['PENDING', 'CANCELLED'] },
      },
      include: {
        driver:  { select: { id: true, name: true } },
        mechanic:{ select: { id: true, name: true } },
        messages:{
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { name: true } } },
        },
        vehicle: { select: { make: true, model: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const chats = await Promise.all(
      serviceRequests.map(async (sr) => {
        const unreadCount = await prisma.message.count({
          where: {
            serviceRequestId: sr.id,
            senderId: { not: req.userId },
            read: false,
          },
        });

        const otherParty = sr.driverId === req.userId ? sr.mechanic : sr.driver;
        const lastMessage = sr.messages[0] || null;

        return {
          serviceRequestId: sr.id,
          otherParty,
          vehicle: sr.vehicle,
          issueType: sr.issueType,
          status: sr.status,
          lastMessage,
          unreadCount,
        };
      })
    );

    res.json({ chats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a message (sender only, within 5 minutes)
export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  const { messageId } = req.params;

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (message.senderId !== req.userId) {
      res.status(403).json({ error: 'You can only delete your own messages' });
      return;
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (message.createdAt < fiveMinutesAgo) {
      res.status(400).json({ error: 'Messages can only be deleted within 5 minutes of sending' });
      return;
    }

    await prisma.message.delete({ where: { id: messageId } });

    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};