import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import vehicleRoutes from './routes/vehicleRoutes';
import serviceRequestRoutes from './routes/serviceRequestRoutes'; // ADD THIS

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'TorqLink API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/requests', serviceRequestRoutes); // ADD THIS

app.listen(PORT, () => {
  console.log(`TorqLink server running on http://localhost:${PORT}`);
});