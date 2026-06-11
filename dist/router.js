import { Router } from 'express';
import { prisma } from './modules/db.js';
const router = Router();
/**
 * Get all service requests for the logged-in user
 */
router.get('/request', async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { requests: true } // We'll link this in the schema next
    });
    res.json({ data: user?.requests });
});
/**
 * Create a new roadside assistance request
 */
router.post('/request', async (req, res) => {
    const request = await prisma.serviceRequest.create({
        data: {
            type: req.body.type,
            location: req.body.location,
            userId: req.user.id
        }
    });
    res.json({ data: request });
});
export default router;
//# sourceMappingURL=router.js.map