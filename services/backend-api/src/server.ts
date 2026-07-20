 import express from 'express';
import cors from 'cors';
import { prisma } from './modules/db.js';
import { hashPassword, comparePasswords, createJWT } from './modules/auth.js';

const app = express();
app.use(cors());
app.use(express.json());

// 1. SIGNUP ROUTE
app.post('/user', async (req, res) => {
  try {
    const user = await prisma.user.create({
      data: {
        email: req.body.email,
        password: await hashPassword(req.body.password),
        name: req.body.name
      }
    });
    const token = createJWT(user);
    res.json({ token });
  } catch (e) {
    res.status(400).json({ error: "User already exists or data invalid" });
  }
});

// 2. LOGIN ROUTE
app.post('/signin', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { email: req.body.email }
  });

  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  const isValid = await comparePasswords(req.body.password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = createJWT(user);
  res.json({ token });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 TorqLink Engine live on http://localhost:${PORT}`);
});