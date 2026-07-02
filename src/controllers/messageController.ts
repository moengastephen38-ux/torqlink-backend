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
    // Confirm the sender is part of this job (driver or assigned mechanic)
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      include: {
        driver:   { select: { id: true, name: true, pushToken: true } },
        mechanic: { select: { id: true, name: true, pushToken: true } },
      },
    });

    if (!serviceRequest) {
      res.status(404).json({ error: 'Service request not found' });
      return;
    }

    const isDriver   = serviceRequest.driverId === req.userId;
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
    });

    // Notify the other party
    const recipient = isDriver ? serviceRequest.mechanic : serviceRequest.driver;
    const senderName = isDriver ? serviceRequest.driver.name : serviceRequest.mechanic?.name;

    if (recipient?.pushToken) {
      sendPushNotification(
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

// Get all messages for a service request
export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  const { serviceRequestId } = req.params;

  try {
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      select: { driverId: true, mechanicId: true },
    });

    if (!serviceRequest) {
      res.status(404).json({ error: 'Service request not found' });
      return;
    }

    const isDriver   = serviceRequest.driverId === req.userId;
    const isMechanic = serviceRequest.mechanicId === req.userId;

    if (!isDriver && !isMechanic) {
      res.status(403).json({ error: 'You are not part of this job' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { serviceRequestId },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Mark messages from the other party as read
    await prisma.message.updateMany({
      where: {
        serviceRequestId,
        senderId: { not: req.userId },
        read: false,
      },
      data: { read: true },
    });

    res.json({ messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get unread message count for a service request (for badge indicators)
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