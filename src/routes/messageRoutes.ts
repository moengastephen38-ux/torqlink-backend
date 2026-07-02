import { Router } from 'express';
import { sendMessage, getMessages, getUnreadCount } from '../controllers/messageController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.post('/send', protect, sendMessage);
router.get('/:serviceRequestId', protect, getMessages);
router.get('/:serviceRequestId/unread', protect, getUnreadCount);

export default router;