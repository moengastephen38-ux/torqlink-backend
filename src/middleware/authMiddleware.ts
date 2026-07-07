 import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend the core Express Request interface to prevent top-level extraction errors
export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  user?: {
    id: string;
    role: string;
  };
}

export const protect = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      userId: string;
      role: string;
    };

    // Set both styles to satisfy all controllers across your project
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    
    req.user = {
      id: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Restrict a route to specific roles
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Check top-level or nested user object roles
    const currentRole = req.userRole || req.user?.role;

    if (!currentRole || !allowedRoles.includes(currentRole)) {
      res.status(403).json({ error: 'You do not have permission to perform this action' });
      return;
    }
    next();
  };
};