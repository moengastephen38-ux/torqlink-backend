import { Router } from 'express';
import {
  submitVerification,
  getMyVerificationStatus,
  getPendingVerifications,
  reviewVerification,
} from '../controllers/verificationController';
import { protect } from '../middleware/authMiddleware';
import { upload } from '../middleware/upload';

const router = Router();

router.post(
  '/submit',
  protect,
  upload.fields([
    { name: 'certificate', maxCount: 1 },
    { name: 'nationalId', maxCount: 1 },
    { name: 'businessPermit', maxCount: 1 },
    { name: 'workshopPhoto', maxCount: 1 },
  ]),
  submitVerification
);

router.get('/my-status', protect, getMyVerificationStatus);
router.get('/pending', protect, getPendingVerifications);
router.patch('/:mechanicId/review', protect, reviewVerification);

export default router;