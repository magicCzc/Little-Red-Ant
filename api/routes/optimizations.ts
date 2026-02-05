import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get all optimizations
router.get('/', (req, res) => {
    try {
        const status = req.query.status as string;
        let query = 'SELECT * FROM prompt_optimizations';
        const params: any[] = [];

        if (status) {
            query += ' WHERE status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const data = db.prepare(query).all(...params);
        
        // Parse JSON fields
        const formatted = data.map((item: any) => ({
            ...item,
            performance_metrics: item.performance_metrics ? JSON.parse(item.performance_metrics) : null
        }));

        res.json({ success: true, data: formatted });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Apply Optimization
router.post('/:id/apply', (req, res) => {
    try {
        const id = req.params.id;
        
        // 1. Get optimization
        const opt = db.prepare('SELECT * FROM prompt_optimizations WHERE id = ?').get(id) as any;
        if (!opt) return res.status(404).json({ success: false, error: 'Optimization not found' });
        
        if (opt.status === 'APPLIED') return res.status(400).json({ success: false, error: 'Already applied' });

        db.transaction(() => {
            // 2. Update Template
            if (opt.original_template_id) {
                // Update existing
                db.prepare('UPDATE prompt_templates SET template = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                  .run(opt.optimized_template, opt.original_template_id);
            } else {
                // Create new template if original didn't exist (dynamic style)
                // Check if name exists first to avoid unique constraint error
                const existing = db.prepare('SELECT id FROM prompt_templates WHERE name = ?').get(opt.target_style) as any;
                if (existing) {
                    db.prepare('UPDATE prompt_templates SET template = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                      .run(opt.optimized_template, existing.id);
                } else {
                    db.prepare('INSERT INTO prompt_templates (name, description, template, is_default, version) VALUES (?, ?, ?, 0, 1)')
                      .run(opt.target_style, `AI Optimized for ${opt.target_style}`, opt.optimized_template);
                }
            }

            // 3. Mark as Applied
            db.prepare("UPDATE prompt_optimizations SET status = 'APPLIED' WHERE id = ?").run(id);
        })();

        res.json({ success: true, message: 'Optimization applied successfully' });

    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reject Optimization
router.post('/:id/reject', (req, res) => {
    try {
        db.prepare("UPDATE prompt_optimizations SET status = 'REJECTED' WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
