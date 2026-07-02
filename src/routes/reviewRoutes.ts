import { Router } from 'express';
import { submitReview, getMechanicReviews } from '../controllers/reviewController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.post('/submit', protect, submitReview);
router.get('/:mechanicId', getMechanicReviews);

export default router;