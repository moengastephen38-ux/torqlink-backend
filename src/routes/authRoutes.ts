 import { Router } from 'express';
import { signup, login, savePushToken } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/push-token', protect, savePushToken);

export default router;