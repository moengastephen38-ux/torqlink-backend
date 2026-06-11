import { Router } from 'express';
import { registerVehicle, getMyVehicles } from '../controllers/vehicleController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', protect, registerVehicle);
router.get('/my', protect, getMyVehicles);

export default router;