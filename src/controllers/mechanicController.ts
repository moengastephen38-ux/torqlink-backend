 import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

// Toggle mechanic online/offline status
export const toggleOnlineStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const mechanic = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isOnline: true, verificationStatus: true },
    });

    if (!mechanic) {
      res.status(404).json({ error: 'Mechanic not found' });
      return;
    }

    if (mechanic.verificationStatus !== 'VERIFIED') {
      res.status(403).json({
        error: 'You must be verified before going online',
        verificationStatus: mechanic.verificationStatus,
      });
      return;
    }

    const newStatus = !mechanic.isOnline;

    await prisma.user.update({
      where: { id: req.userId },
      data: { isOnline: newStatus },
    });

    res.json({
      message: newStatus ? 'You are now Online' : 'You are now Offline',
      isOnline: newStatus,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get online status
export const getOnlineStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const mechanic = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isOnline: true },
    });

    res.json({ isOnline: mechanic?.isOnline || false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update mechanic profile
export const updateMechanicProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const { laborRate, specialization, toolsOnHand, bio } = req.body;

  if (req.userRole !== 'MECHANIC' && req.userRole !== 'ADMIN') {
    res.status(403).json({ error: 'Only mechanics can update a mechanic profile' });
    return;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        laborRate:     laborRate     ? parseFloat(laborRate) : undefined,
        specialization: specialization || undefined,
        toolsOnHand:   toolsOnHand   || undefined,
        bio:           bio           || undefined,
      },
      select: {
        id: true, name: true, phone: true,
        laborRate: true, specialization: true,
        toolsOnHand: true, bio: true,
        verificationStatus: true, isOnline: true,
      },
    });

    res.json({ message: 'Profile updated successfully', mechanic: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get a mechanic's public profile
export const getMechanicProfile = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const mechanic = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, phone: true,
        laborRate: true, specialization: true,
        toolsOnHand: true, bio: true,
        avatarUrl: true, verificationStatus: true, isOnline: true,
        reviewsReceived: { select: { rating: true } },
        mechanicRequests: {
          where: { status: 'RESOLVED' },
          select: { id: true },
        },
      },
    });

    if (!mechanic) {
      res.status(404).json({ error: 'Mechanic not found' });
      return;
    }

    const totalJobs    = mechanic.mechanicRequests.length;
    const totalReviews = mechanic.reviewsReceived.length;
    const avgRating    = totalReviews > 0
      ? mechanic.reviewsReceived.reduce((s, r) => s + r.rating, 0) / totalReviews
      : null;

    res.json({
      mechanic: {
        id:                 mechanic.id,
        name:               mechanic.name,
        phone:              mechanic.phone,
        laborRate:          mechanic.laborRate,
        specialization:     mechanic.specialization,
        toolsOnHand:        mechanic.toolsOnHand,
        bio:                mechanic.bio,
        avatarUrl:          mechanic.avatarUrl,
        verificationStatus: mechanic.verificationStatus,
        isOnline:           mechanic.isOnline,
        totalJobs,
        avgRating: avgRating ? parseFloat(avgRating.toFixed(1)) : null,
        totalReviews,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get mechanic's own stats
export const getMyMechanicStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const mechanic = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, name: true, phone: true,
        laborRate: true, specialization: true,
        toolsOnHand: true, bio: true,
        avatarUrl: true, verificationStatus: true, isOnline: true,
        reviewsReceived: {
          select: { rating: true, comment: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        mechanicRequests: {
          where: { status: 'RESOLVED' },
          select: { id: true },
        },
        wallet: true,
      },
    });

    if (!mechanic) {
      res.status(404).json({ error: 'Mechanic not found' });
      return;
    }

    const totalJobs    = mechanic.mechanicRequests.length;
    const totalReviews = mechanic.reviewsReceived.length;
    const avgRating    = totalReviews > 0
      ? mechanic.reviewsReceived.reduce((s, r) => s + r.rating, 0) / totalReviews
      : null;

    res.json({
      mechanic: {
        id:                 mechanic.id,
        name:               mechanic.name,
        phone:              mechanic.phone,
        laborRate:          mechanic.laborRate,
        specialization:     mechanic.specialization,
        toolsOnHand:        mechanic.toolsOnHand,
        bio:                mechanic.bio,
        avatarUrl:          mechanic.avatarUrl,
        verificationStatus: mechanic.verificationStatus,
        isOnline:           mechanic.isOnline,
        totalJobs,
        avgRating: avgRating ? parseFloat(avgRating.toFixed(1)) : null,
        totalReviews,
        recentReviews: mechanic.reviewsReceived,
        wallet:        mechanic.wallet,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
// Update mechanic live GPS location
export const updateLiveLocation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { latitude, longitude } = req.body;

  if (latitude === undefined || longitude === undefined) {
    res.status(400).json({
      error: 'Latitude and longitude are required',
    });
    return;
  }

  try {
    const mechanic = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        role: true,
        verificationStatus: true,
      },
    });

    if (!mechanic) {
      res.status(404).json({ error: 'Mechanic not found' });
      return;
    }

    if (mechanic.role !== 'MECHANIC') {
      res.status(403).json({
        error: 'Only mechanics can update location',
      });
      return;
    }

    if (mechanic.verificationStatus !== 'VERIFIED') {
      res.status(403).json({
        error: 'Mechanic must be verified',
      });
      return;
    }

    await prisma.user.update({
      where: {
        id: req.userId,
      },
      data: {
        latitude: Number(latitude),
        longitude: Number(longitude),
        lastLocationUpdate: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Location updated',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
};