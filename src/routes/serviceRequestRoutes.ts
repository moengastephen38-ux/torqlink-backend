import { Router } from 'express';
import {
  createRequest,
  getNearbyRequests,
  acceptRequest,
  updateStatus,
  getMyRequests,
} from '../controllers/serviceRequestController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.post('/create', protect, createRequest);
router.get('/nearby', protect, getNearbyRequests);
router.get('/my', protect, getMyRequests);
router.patch('/:id/accept', protect, acceptRequest);
router.patch('/:id/status', protect, updateStatus);

export default router;