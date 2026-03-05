import { Router } from 'express';
import db from '../db.js';
import { updateSelectorsFromDB } from '../services/rpa/config/selectors.js';
import { Logger } from '../services/LoggerService.js';

const router = Router();

// GET /api/config/selectors
// List all dynamic selectors
router.get('/selectors', (req, res) => {
    try {
        const selectors = db.prepare('SELECT * FROM rpa_selectors ORDER BY platform, category, key').all();
        res.json({ success: true, selectors });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/config/selectors
// Create or Update a selector
router.post('/selectors', (req, res) => {
    const { platform = 'xiaohongshu', category, key, selector, description } = req.body;
    
    if (!category || !key || !selector) {
        return res.status(400).json({ error: 'Missing required fields: category, key, selector' });
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO rpa_selectors (platform, category, key, selector, description, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(platform, category, key) 
            DO UPDATE SET selector = excluded.selector, description = excluded.description, updated_at = CURRENT_TIMESTAMP
        `);
        
        stmt.run(platform, category, key, selector, description);
        
        // Auto-reload to apply changes immediately
        updateSelectorsFromDB();
        
        res.json({ success: true, message: 'Selector updated and applied' });
    } catch (error: any) {
        Logger.error('API:Config', 'Failed to update selector', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/config/selectors/reload
// Force reload selectors from DB (Hot Reload)
router.post('/selectors/reload', (req, res) => {
    try {
        updateSelectorsFromDB();
        res.json({ success: true, message: 'Selectors reloaded from database' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/config/selectors/:id
router.delete('/selectors/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM rpa_selectors WHERE id = ?').run(req.params.id);
        updateSelectorsFromDB();
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
