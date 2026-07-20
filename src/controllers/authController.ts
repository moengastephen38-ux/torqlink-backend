import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

const generateToken = (userId: string, role: string): string => {
  if (!process.env.JWT_SECRET) {
    console.error("❌ CRITICAL: JWT_SECRET environment variable is missing!");
    throw new Error("JWT_SECRET is missing from environment variables");
  }
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export const signup = async (req: Request, res: Response): Promise<void> => {
  console.log("==========================================");
  console.log("👉 [1/5] SIGNUP INCOMING REQUEST");
  console.log("Content-Type Header:", req.headers['content-type']);
  console.log("Parsed Body:", JSON.stringify(req.body));

  const { name, email, password, phone, role } = req.body || {};

  if (!name || !email || !password) {
    console.warn("⚠️ [2/5] Validation Failed: Missing required fields");
    res.status(400).json({ error: 'Name, email and password are required' });
    return;
  }

  try {
    console.log("👉 [2/5] Querying database for existing email:", email);
    const existingUser = await prisma.user.findUnique({ where: { email } });
    
    if (existingUser) {
      console.warn("⚠️ [3/5] User already exists:", email);
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    console.log("👉 [3/5] Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 12);

    console.log("👉 [4/5] Inserting user into Neon DB via Prisma...");
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone: phone || null,
        role: role ? String(role).toUpperCase() : 'DRIVER',
      },
    });

    console.log("👉 [5/5] Generating JWT for user ID:", user.id);
    const token = generateToken(user.id, user.role);

    console.log("✅ SIGNUP SUCCESSFUL for:", email);
    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("❌ SIGNUP ERROR DETAILED STACK TRACE:");
    console.error(error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error?.message || 'Unknown database/server failure'
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  console.log("==========================================");
  console.log("👉 LOGIN INCOMING REQUEST");
  console.log("Parsed Body:", JSON.stringify(req.body));

  const { email, password } = req.body || {};

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    console.log("👉 Fetching user record for:", email);
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      console.warn("⚠️ Login failed: User not found");
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    console.log("👉 Verifying password match...");
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.warn("⚠️ Login failed: Password mismatch");
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user.id, user.role);

    console.log("✅ LOGIN SUCCESSFUL for:", email);
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("❌ LOGIN ERROR DETAILED STACK TRACE:");
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, phone: true, role: true, pushToken: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error("❌ GET ME ERROR:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const savePushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  const { pushToken } = req.body || {};

  if (!pushToken) {
    res.status(400).json({ error: 'pushToken is required' });
    return;
  }

  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { pushToken },
    });

    res.json({ message: 'Push token saved' });
  } catch (error) {
    console.error("❌ SAVE PUSH TOKEN ERROR:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
};