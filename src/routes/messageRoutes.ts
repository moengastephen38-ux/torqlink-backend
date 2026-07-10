 import { Router } from 'express';
import {
  sendMessage,
  getMessages,
  getUnreadCount,
  getMyChats,
  deleteMessage,
} from '../controllers/messageController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.post('/send',                    protect, sendMessage);
router.get('/my-chats',                 protect, getMyChats);
router.get('/:serviceRequestId',        protect, getMessages);
router.get('/:serviceRequestId/unread', protect, getUnreadCount);
router.delete('/:messageId',            protect, deleteMessage);

export default router;