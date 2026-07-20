import { Request, Response, NextFunction } from 'express';

export const handleInputErrors = (req: Request, res: Response, next: NextFunction) => {
  // Add validation logic here later if needed
  next();
};

// Protects routes so only logged-in users can access them
export const protect = (req: any, res: Response, next: NextFunction) => {
  const bearer = req.headers.authorization;

  if (!bearer) {
    res.status(401).json({ message: 'Not authorized' });
    return;
  }

  // Token logic goes here
  next();
};