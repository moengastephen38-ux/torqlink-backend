 import { Router } from 'express';
import {
  initiatePayment,
  mpesaCallback,
  getPaymentStatus,
  getWallet,
  payForListing,
  payForShopSubscription,
} from '../controllers/paymentController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.post('/stk-push', protect, initiatePayment);
router.post('/callback', mpesaCallback);
router.get('/status/:serviceRequestId', protect, getPaymentStatus);
router.get('/wallet', protect, getWallet);
router.post('/listing-fee', protect, payForListing);
router.post('/shop-subscription', protect, payForShopSubscription);

export default router;