 import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/authRoutes';
import vehicleRoutes from './routes/vehicleRoutes';
import serviceRequestRoutes from './routes/serviceRequestRoutes';
import paymentRoutes from './routes/paymentRoutes';
import marketplaceRoutes from './routes/marketplaceRoutes';
import verificationRoutes from './routes/verificationRoutes';
import mechanicRoutes from './routes/mechanicRoutes';
import reviewRoutes from './routes/reviewRoutes';
import messageRoutes from './routes/messageRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => {
  res.json({ message: 'TorqLink API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/requests', serviceRequestRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/mechanics', mechanicRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/messages', messageRoutes);

app.listen(PORT, () => {
  console.log(`TorqLink server running on http://localhost:${PORT}`);
});