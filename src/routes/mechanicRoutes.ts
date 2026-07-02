 import { Router } from 'express';
import {
  updateMechanicProfile,
  getMechanicProfile,
  getMyMechanicStats,
  toggleOnlineStatus,
  getOnlineStatus,
} from '../controllers/mechanicController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.put('/profile',       protect, updateMechanicProfile);
router.get('/my-stats',      protect, getMyMechanicStats);
router.get('/online-status', protect, getOnlineStatus);
router.patch('/toggle-online', protect, toggleOnlineStatus);
router.get('/:id/profile',   getMechanicProfile);

export default router;