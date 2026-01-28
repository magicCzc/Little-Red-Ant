import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SettingsService } from '../services/SettingsService.js';

const DEFAULT_SECRET = 'little-red-ant-secret-key-2026';

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
    // 1. Get Secret
    let secret = await SettingsService.get('JWT_SECRET');
    if (!secret) {
        secret = DEFAULT_SECRET;
    }

    // 2. Get Token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // 3. Verify
    jwt.verify(token, secret, (err: any, user: any) => {
        if (err) {
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
