import express from 'express';
import cors from 'cors';
import { prisma } from './modules/db.js';
import { hashPassword, comparePasswords, createJWT, protect } from './modules/auth.js';
 import router from './routes/router';
const app = express();
// Standard middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
/**
 * PUBLIC ROUTE: Health Check
 */
app.get('/', (req, res) => {
    res.json({ status: "TorqLink API is Online", version: "1.0.0" });
});
/**
 * PUBLIC AUTH ROUTES
 */
app.post('/user', async (req, res) => {
    try {
        const user = await prisma.user.create({
            data: {
                email: req.body.email,
                password: await hashPassword(req.body.password),
                name: req.body.name,
            },
        });
        const token = createJWT(user);
        res.json({ token });
    }
    catch (e) {
        res.status(400).json({ error: 'User registration failed.' });
    }
});
app.post('/signin', async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { email: req.body.email },
    });
    if (!user || !(await comparePasswords(req.body.password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = createJWT(user);
    res.json({ token });
});
/**
 * PROTECTED API ROUTES
 * All requests to /api/* require a valid JWT token
 */
app.use('/api', protect, router);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 TorqLink Engine live on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map