import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config.js';

export interface AuthRequest extends Request {
    user?: {
        id: number;
        username: string;
        alias?: string;
        role: string;
        permissions?: string[];
    };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    // 1. Get Secret from Config
    const secret = config.security.jwtSecret;

    // 2. Get Token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        console.warn(`[Auth] Access denied: No token provided. Path: ${req.path}`);
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // 3. Verify
    jwt.verify(token, secret, (err: any, user: any) => {
        if (err) {
            console.warn(`[Auth] Invalid token: ${err.message}. Path: ${req.path}`);
            return res.status(403).json({ error: 'Invalid token.' });
        }
        req.user = user;
        next();
    });
};

export const requirePermission = (permission: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Admin has all permissions
        if (user.role === 'admin') {
            return next();
        }

        const userPermissions = user.permissions || [];
        if (userPermissions.includes(permission)) {
            return next();
        }

        return res.status(403).json({ error: `Permission denied: Requires ${permission}` });
    };
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (user.role === 'admin') {
        return next();
    }

    return res.status(403).json({ error: 'Permission denied: Admin role required' });
};
