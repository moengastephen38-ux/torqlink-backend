import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

// Driver submits a review after job is resolved
export const submitReview = async (req: AuthRequest, res: Response): Promise<void> => {
  const { serviceRequestId, rating, comment } = req.body;

  if (!serviceRequestId || !rating) {
    res.status(400).json({ error: 'serviceRequestId and rating are required' });
    return;
  }

  if (rating < 1 || rating > 5) {
    res.status(400).json({ error: 'Rating must be between 1 and 5' });
    return;
  }

  try {
    const serviceRequest = await prisma.serviceRequest.findFirst({
      where: { id: serviceRequestId, driverId: req.userId, status: 'RESOLVED' },
    });

    if (!serviceRequest) {
      res.status(404).json({ error: 'Resolved service request not found' });
      return;
    }

    if (!serviceRequest.mechanicId) {
      res.status(400).json({ error: 'No mechanic assigned to this request' });
      return;
    }

    const existing = await prisma.review.findUnique({
      where: { serviceRequestId },
    });

    if (existing) {
      res.status(409).json({ error: 'You have already reviewed this job' });
      return;
    }

    const review = await prisma.review.create({
      data: {
        rating,
        comment: comment || null,
        serviceRequestId,
        fromUserId: req.userId as string,
        toUserId: serviceRequest.mechanicId,
      },
    });

    res.status(201).json({ message: 'Review submitted. Thank you!', review });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all reviews for a mechanic
export const getMechanicReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  const { mechanicId } = req.params;

  try {
    const reviews = await prisma.review.findMany({
      where: { toUserId: mechanicId },
      include: {
        fromUser: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const avg = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

    res.json({
      avgRating: avg ? parseFloat(avg.toFixed(1)) : null,
      totalReviews: reviews.length,
      reviews,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};