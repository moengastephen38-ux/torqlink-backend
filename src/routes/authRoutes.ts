import { Router } from 'express';
import { signup, login, savePushToken, getMe } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// Public Auth Endpoints
router.post('/signup', signup);
router.post('/login', login);

// Protected Auth Endpoints
router.get('/me', protect, getMe);
router.post('/push-token', protect, savePushToken);

export default router;