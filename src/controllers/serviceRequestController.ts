import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getDistanceKm } from '../utils/haversine';

// Driver creates a breakdown request
export const createRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  const { description, issueType, latitude, longitude, vehicleId } = req.body;

  if (!description || !issueType || !latitude || !longitude || !vehicleId) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }

  try {
    // Confirm vehicle belongs to this driver
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, userId: req.userId },
    });

    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found or does not belong to you' });
      return;
    }

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        description,
        issueType,
        latitude,
        longitude,
        driverId: req.userId as string,
        vehicleId,
      },
      include: {
        vehicle: true,
        driver: { select: { id: true, name: true, phone: true } },
      },
    });

    res.status(201).json({
      message: 'Help request created successfully',
      serviceRequest,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Mechanic gets all pending requests near their location
export const getNearbyRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  const { latitude, longitude, radiusKm = 10 } = req.query;

  if (!latitude || !longitude) {
    res.status(400).json({ error: 'latitude and longitude are required' });
    return;
  }

  try {
    const allPending = await prisma.serviceRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        vehicle: true,
        driver: { select: { id: true, name: true, phone: true } },
      },
    });

    // Filter by distance using Haversine formula
    const nearby = allPending.filter((request) => {
      const distance = getDistanceKm(
        parseFloat(latitude as string),
        parseFloat(longitude as string),
        request.latitude,
        request.longitude
      );
      return distance <= parseFloat(radiusKm as string);
    }).map((request) => ({
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

// Mechanic accepts a request
export const acceptRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const existing = await prisma.serviceRequest.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    if (existing.status !== 'PENDING') {
      res.status(400).json({ error: 'This request has already been accepted or resolved' });
      return;
    }

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        mechanicId: req.userId,
      },
      include: {
        vehicle: true,
        driver: { select: { id: true, name: true, phone: true } },
        mechanic: { select: { id: true, name: true, phone: true } },
      },
    });

    res.json({ message: 'Request accepted', serviceRequest: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update request status
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
    });

    res.json({ message: `Status updated to ${status}`, serviceRequest: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Driver views their own requests
export const getMyRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requests = await prisma.serviceRequest.findMany({
      where: { driverId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        vehicle: true,
        mechanic: { select: { id: true, name: true, phone: true } },
      },
    });

    res.json({ requests });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};