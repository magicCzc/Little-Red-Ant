import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get all templates
router.get('/', (req, res) => {
    try {
        const list = db.prepare('SELECT * FROM prompt_templates ORDER BY is_default DESC, created_at DESC').all();
        res.json(list);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Create new template
router.post('/', (req, res) => {
    const { name, description, template } = req.body;
    if (!name || !template) return res.status(400).json({ error: 'Name and template are required' });

    try {
        const stmt = db.prepare('INSERT INTO prompt_templates (name, description, template) VALUES (?, ?, ?)');
        const info = stmt.run(name, description || '', template);
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete template
router.delete('/:id', (req, res) => {
    try {
        // Protect defaults
        const tpl = db.prepare('SELECT is_default FROM prompt_templates WHERE id = ?').get(req.params.id) as any;
        if (tpl && tpl.is_default) {
            return res.status(403).json({ error: 'Cannot delete default templates' });
        }

        db.prepare('DELETE FROM prompt_templates WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
