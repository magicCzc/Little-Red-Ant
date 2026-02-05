import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import config from '../config.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Register (Create Account) - Only for System Initialization
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        // Security Check: Only allow if no users exist
        const count = db.prepare('SELECT COUNT(*) as c FROM admin_users').get() as { c: number };
        if (count.c > 0) {
            return res.status(403).json({ error: 'System already initialized. Please ask an admin to create an account.' });
        }

        // Check if username exists (redundant if count > 0 check passes, but safe)
        const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);
        if (existing) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert - First user is always Admin
        const stmt = db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)');
        const info = stmt.run(username, hashedPassword, 'admin');

        res.json({ success: true, message: 'Admin registered successfully', userId: info.lastInsertRowid });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as any;
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate Token
        const secret = config.security.jwtSecret;

        const token = jwt.sign(
            { id: user.id, username: user.username, alias: user.alias, role: user.role }, 
            secret, 
            { expiresIn: '7d' }
        );

        res.json({ 
            success: true, 
            token, 
            user: { id: user.id, username: user.username, alias: user.alias, role: user.role } 
        });

    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Current User
router.get('/me', authenticateToken, (req: AuthRequest, res) => {
    res.json({ user: req.user });
});

// Init Check (Check if any admin exists)
router.get('/init-check', (req, res) => {
    try {
        const count = db.prepare('SELECT COUNT(*) as c FROM admin_users').get() as { c: number };
        res.json({ hasUsers: count.c > 0 });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
