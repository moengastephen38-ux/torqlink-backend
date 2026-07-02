import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

// Mechanic submits verification documents
export const submitVerification = async (req: AuthRequest, res: Response): Promise<void> => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const { yearsExperience, specialization } = req.body;

  if (req.userRole !== 'MECHANIC') {
    res.status(403).json({ error: 'Only mechanics can submit verification documents' });
    return;
  }

  if (!files?.certificate || !files?.nationalId) {
    res.status(400).json({ error: 'Certificate and National ID are required' });
    return;
  }

  try {
    const buildUrl = (file: Express.Multer.File) => `/uploads/verification/${file.filename}`;

    const data = {
      certificateUrl: buildUrl(files.certificate[0]),
      nationalIdUrl: buildUrl(files.nationalId[0]),
      businessPermitUrl: files.businessPermit ? buildUrl(files.businessPermit[0]) : null,
      workshopPhotoUrl: files.workshopPhoto ? buildUrl(files.workshopPhoto[0]) : null,
      yearsExperience: yearsExperience ? parseInt(yearsExperience) : null,
      specialization: specialization || null,
      status: 'PENDING' as const,
      submittedAt: new Date(),
    };

    const verification = await prisma.mechanicVerification.upsert({
      where: { mechanicId: req.userId },
      update: data,
      create: { ...data, mechanicId: req.userId as string },
    });

    await prisma.user.update({
      where: { id: req.userId },
      data: { verificationStatus: 'PENDING' },
    });

    res.status(201).json({
      message: 'Verification documents submitted. Your account will be reviewed shortly.',
      verification,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Mechanic checks their own verification status
export const getMyVerificationStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const verification = await prisma.mechanicVerification.findUnique({
      where: { mechanicId: req.userId },
    });

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { verificationStatus: true },
    });

    res.json({
      status: user?.verificationStatus || 'NOT_SUBMITTED',
      verification,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: list all pending verifications
export const getPendingVerifications = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userRole !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access only' });
    return;
  }

  try {
    const pending = await prisma.mechanicVerification.findMany({
      where: { status: 'PENDING' },
      include: {
        mechanic: { select: { id: true, name: true, email: true, phone: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });

    res.json({ count: pending.length, pending });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: approve or reject a verification
export const reviewVerification = async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.userRole !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access only' });
    return;
  }

  const { mechanicId } = req.params;
  const { approve, rejectionReason } = req.body;

  try {
    const verification = await prisma.mechanicVerification.findUnique({
      where: { mechanicId },
    });

    if (!verification) {
      res.status(404).json({ error: 'Verification record not found' });
      return;
    }

    const newStatus = approve ? 'VERIFIED' : 'REJECTED';

    await prisma.mechanicVerification.update({
      where: { mechanicId },
      data: {
        status: newStatus,
        rejectionReason: approve ? null : rejectionReason,
        reviewedAt: new Date(),
      },
    });

    await prisma.user.update({
      where: { id: mechanicId },
      data: { verificationStatus: newStatus },
    });

    res.json({ message: `Mechanic ${approve ? 'verified' : 'rejected'} successfully` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};