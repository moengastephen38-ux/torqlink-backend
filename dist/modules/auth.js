import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
/**
 * HASHER: Turns "password123" into a scrambled string that can't be reversed.
 * We use a salt round of 5 for a good balance of speed and security.
 */
export const hashPassword = (password) => {
    return bcrypt.hash(password, 5);
};
/**
 * COMPARER: Checks the password the user typed against the scrambled version in the DB.
 */
export const comparePasswords = (password, hash) => {
    return bcrypt.compare(password, hash);
};
/**
 * TOKEN GENERATOR: Creates a secure "passport" (JWT) for the user.
 * This allows them to make requests without logging in every single time.
 */
export const createJWT = (user) => {
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET);
    return token;
};
/**
 * PROTECTOR: Middleware to check if a user is allowed to access specific routes.
 */
export const protect = (req, res, next) => {
    const bearer = req.headers.authorization;
    if (!bearer) {
        res.status(401).json({ message: 'Not authorized' });
        return;
    }
    const [, token] = bearer.split(' ');
    if (!token) {
        res.status(401).json({ message: 'Invalid token' });
        return;
    }
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        next();
    }
    catch (e) {
        res.status(401).json({ message: 'Invalid token' });
        return;
    }
};
//# sourceMappingURL=auth.js.map