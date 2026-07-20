import { Router } from 'express';
import { signup, login, getMe, savePushToken } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// Public Endpoints
router.post('/signup', signup);
router.post('/login', login);

// Protected Endpoints
router.get('/me', protect, getMe);
router.post('/push-token', protect, savePushToken);

export default router;