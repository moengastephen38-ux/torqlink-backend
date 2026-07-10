 import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getDistanceKm } from '../utils/haversine';
import {
  sendPushNotification,
  notifyJobAccepted,
  notifyMechanicEnRoute,
  notifyJobResolved,
} from '../services/notifications';

export const createRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  const { description, issueType, latitude, longitude, vehicleId } = req.body;

  if (!description || !issueType || !latitude || !longitude || !vehicleId) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }

  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, userId: req.userId },
    });

    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found or does not belong to you' });
      return;
    }

    const serviceRequest = await prisma.serviceRequest.create({
      data: { description, issueType, latitude, longitude, driverId: req.userId as string, vehicleId },
      include: {
        vehicle: true,
        driver: { select: { id: true, name: true, phone: true } },
      },
    });

    const onlineMechanics = await prisma.user.findMany({
      where: {
        role: 'MECHANIC',
        isOnline: true,
        verificationStatus: 'VERIFIED',
        pushToken: { not: null },
      },
      select: { pushToken: true, id: true },
    });

    for (const mech of onlineMechanics) {
      sendPushNotification(
        mech.pushToken,
        '🚨 New Job Nearby',
        `${issueType.replace(/_/g, ' ')} — ${vehicle.make} ${vehicle.model}`,
        { type: 'NEW_JOB', requestId: serviceRequest.id }
      );
    }

    res.status(201).json({ message: 'Help request created successfully', serviceRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNearbyRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  const { latitude, longitude, radiusKm = 10 } = req.query;

  if (!latitude || !longitude) {
    res.status(400).json({ error: 'latitude and longitude are required' });
    return;
  }

  try {
    const mechanic = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { verificationStatus: true, isOnline: true },
    });

    if (mechanic?.verificationStatus !== 'VERIFIED') {
      res.status(403).json({
        error: 'Your account is not yet verified.',
        verificationStatus: mechanic?.verificationStatus || 'NOT_SUBMITTED',
      });
      return;
    }

    if (!mechanic?.isOnline) {
      res.status(403).json({
        error: 'You are currently offline. Go online to see jobs.',
        isOnline: false,
      });
      return;
    }

    const allPending = await prisma.serviceRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        vehicle: true,
        driver: { select: { id: true, name: true, phone: true } },
      },
    });

    const nearby = allPending
      .filter((request) => {
        const distance = getDistanceKm(
          parseFloat(latitude as string),
          parseFloat(longitude as string),
          request.latitude,
          request.longitude
        );
        return distance <= parseFloat(radiusKm as string);
      })
      .map((request) => ({
        ...request,
        distanceKm: getDistanceKm(
          parseFloat(latitude as string),
          parseFloat(longitude as string),
          request.latitude,
          request.longitude
        ).toFixed(2),
      }));

    res.json({ count: nearby.length, requests: nearby });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const acceptRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const mechanic = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { verificationStatus: true, isOnline: true, name: true },
    });

    if (mechanic?.verificationStatus !== 'VERIFIED') {
      res.status(403).json({ error: 'Your account must be verified before accepting jobs' });
      return;
    }

    if (!mechanic?.isOnline) {
      res.status(403).json({ error: 'You must be online to accept jobs' });
      return;
    }

    const result = await prisma.serviceRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'ACCEPTED', mechanicId: req.userId },
    });

    if (result.count === 0) {
      const existing = await prisma.serviceRequest.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Request not found' });
      } else {
        res.status(409).json({ error: 'This job has already been accepted by another mechanic' });
      }
      return;
    }

    const updated = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        vehicle: true,
        driver: { select: { id: true, name: true, phone: true, pushToken: true } },
        mechanic: { select: { id: true, name: true, phone: true } },
      },
    });

   if (updated?.driver?.pushToken) {
  await notifyJobAccepted(
    updated.driver.pushToken,
    mechanic.name,
    id
  );
} 

    res.json({ message: 'Request accepted', serviceRequest: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['MECHANIC_EN_ROUTE', 'RESOLVED', 'CANCELLED'];

  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    return;
  }

  try {
    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: { status },
      include: {
        driver: { select: { pushToken: true } },
      },
    });

    const statusMessages: any = {
      MECHANIC_EN_ROUTE: '🚗 Your mechanic is on the way!',
      RESOLVED: '🎉 Your job has been marked as resolved.',
      CANCELLED: 'Your job request has been cancelled.',
    };

    if (updated.driver?.pushToken && statusMessages[status]) {
      sendPushNotification(
        updated.driver.pushToken,
        'TorqLink Update',
        statusMessages[status],
        { type: 'STATUS_UPDATE', requestId: id }
      );
    }

    res.json({ message: `Status updated to ${status}`, serviceRequest: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requests = await prisma.serviceRequest.findMany({
      where: { driverId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: true,
        review: true,
        mechanic: {
          select: {
            id: true,
            name: true,
            phone: true,
            laborRate: true,
            specialization: true,
            toolsOnHand: true,
            verificationStatus: true,
            reviewsReceived: { select: { rating: true } },
            mechanicRequests: {
              where: { status: 'RESOLVED' },
              select: { id: true },
            },
          },
        },
      },
    });

    const enriched = requests.map((request) => {
      const mech = request.mechanic as any;
      if (mech) {
        const totalReviews = mech.reviewsReceived?.length || 0;
        const avgRating = totalReviews > 0
          ? mech.reviewsReceived.reduce((s: number, r: any) => s + r.rating, 0) / totalReviews
          : null;
        mech.avgRating = avgRating ? parseFloat(avgRating.toFixed(1)) : null;
        mech.totalJobs = mech.mechanicRequests?.length || 0;
        mech.totalReviews = totalReviews;
      }
      return request;
    });

    res.json({ requests: enriched });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};