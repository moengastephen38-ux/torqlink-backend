 import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

export const hashPassword = (password: string) => {
    return bcrypt.hash(password, 5);
};

export const comparePasswords = (password: string, hash: string) => {
    return bcrypt.compare(password, hash);
};

export const createJWT = (user: any) => {
    const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET as string
    );
    return token;
};

export const protect = (req: any, res: any, next: any) => {
    const bearer = req.headers.authorization;

    if (!bearer || !bearer.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    const token = bearer.split(' ')[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET as string);
        req.user = payload;
        next();
    } catch (e) {
        console.error(e);
        res.status(401).json({ message: 'Invalid token' });
    }
};