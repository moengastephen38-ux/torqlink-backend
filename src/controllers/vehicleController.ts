import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

export const registerVehicle = async (req: AuthRequest, res: Response): Promise<void> => {
  const { make, model, year, plateNumber, color } = req.body;

  if (!make || !model || !year || !plateNumber) {
    res.status(400).json({ error: 'Make, model, year and plate number are required' });
    return;
  }

  try {
    const existing = await prisma.vehicle.findUnique({ where: { plateNumber } });
    if (existing) {
      res.status(409).json({ error: 'A vehicle with that plate number already exists' });
      return;
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        make,
        model,
        year: parseInt(year),
        plateNumber,
        color: color || null,
        userId: req.userId as string,
      },
    });

    res.status(201).json({
      message: 'Vehicle registered successfully',
      vehicle,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyVehicles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { userId: req.userId as string },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ vehicles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};