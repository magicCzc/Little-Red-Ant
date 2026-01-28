
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Middleware: All routes require Auth & Admin
router.use(authenticateToken);
router.use(requireAdmin);

// Get All Users
router.get('/', (req, res) => {
    try {
        const users = db.prepare('SELECT id, username, role, alias, created_at FROM admin_users ORDER BY created_at DESC').all();
        res.json(users);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Create User
router.post('/', async (req, res) => {
    const { username, password, role, alias } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);
        if (existing) return res.status(400).json({ error: 'Username already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const stmt = db.prepare('INSERT INTO admin_users (username, password_hash, role, alias) VALUES (?, ?, ?, ?)');
        const info = stmt.run(username, hashedPassword, role || 'editor', alias || username);

        res.json({ success: true, id: info.lastInsertRowid });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update User (Role/Alias)
router.put('/:id', (req, res) => {
    const { role, alias } = req.body;
    try {
        db.prepare('UPDATE admin_users SET role = ?, alias = ? WHERE id = ?').run(role, alias, req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete User
router.delete('/:id', (req, res) => {
    try {
        if (req.params.id === '1') return res.status(403).json({ error: 'Cannot delete root admin' });
        db.prepare('DELETE FROM admin_users WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
