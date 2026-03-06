
import { Router } from 'express';
import db from '../db.js';
import { enqueueTask } from '../services/queue.js';
import { DataSanitizer } from '../utils/DataSanitizer.js';
import { wrapError } from '../utils/ErrorMessages.js';

const router = Router();

// Get List
router.get('/', (req, res) => {
    try {
        const list = db.prepare(`
            SELECT id, user_id, nickname, avatar, fans_count, notes_count, 
                   status, last_error, last_updated, analysis_result, latest_notes 
            FROM competitors 
            ORDER BY 
                CASE WHEN status IN ('pending', 'processing', 'refreshing') THEN 0 ELSE 1 END,
                last_updated DESC
        `).all();
        
        const parsedList = list.map((item: any) => {
            let analysis = DataSanitizer.safeJsonParse(item.analysis_result, {});
            
            // Handle legacy raw text or ensure structure
            if (typeof analysis === 'string' && analysis.startsWith('{')) {
                analysis = DataSanitizer.safeJsonParse(analysis, {});
            }

            // 为失败的竞品添加友好错误信息
            let friendlyError = null;
            if (item.status === 'error' && item.last_error) {
                friendlyError = wrapError(item.last_error);
            }

            return {
                ...item,
                latest_notes: DataSanitizer.safeJsonParse(item.latest_notes, []),
                analysis_result: analysis,
                friendlyError
            };
        });
        res.json({ success: true, data: parsedList });
    } catch (error: any) {
        const wrapped = wrapError(error);
        res.status(500).json({ 
            error: error.message,
            friendlyError: wrapped
        });
    }
});

// Get Details (Notes & History)
router.get('/:id', (req, res) => {
    try {
        const competitor = db.prepare('SELECT * FROM competitors WHERE id = ?').get(req.params.id) as any;
        if (!competitor) return res.status(404).json({ error: 'Competitor not found' });

        const notes = db.prepare('SELECT * FROM competitor_notes WHERE competitor_id = ? ORDER BY likes DESC, id ASC').all(req.params.id);
        const statsHistory = db.prepare('SELECT * FROM competitor_stats_history WHERE competitor_id = ? ORDER BY record_date ASC').all(req.params.id);

        let analysis = DataSanitizer.safeJsonParse(competitor.analysis_result, {});
        if (typeof analysis === 'string' && analysis.startsWith('{')) {
             analysis = DataSanitizer.safeJsonParse(analysis, {});
        }

        res.json({
            success: true,
            data: {
                ...competitor,
                analysis_result: analysis,
                notes,
                stats_history: statsHistory
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Add/Analyze (Async)
router.post('/analyze', async (req, res) => {
    const { url: urlFromBody } = req.body;
    let url = urlFromBody;
    if (!url) return res.status(400).json({ error: 'URL or User ID required' });

    try {
        // Normalize ID
        const userId = DataSanitizer.extractUserId(url);
        
        // Check if exists
        const existing = db.prepare('SELECT * FROM competitors WHERE user_id = ?').get(userId) as any;
        let dbId = existing?.id;

        if (existing) {
            // Update status to refreshing
            db.prepare("UPDATE competitors SET status = 'refreshing', last_error = NULL WHERE id = ?").run(existing.id);
        } else {
            // Create new pending record
            const result = db.prepare(`
                INSERT INTO competitors (user_id, nickname, status, created_at, last_updated)
                VALUES (?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(userId, 'New Competitor'); // Nickname will be updated by scraper
            dbId = result.lastInsertRowid;
        }

        // Enqueue Task with DB ID
        const taskId = enqueueTask('SCRAPE_COMPETITOR', { url: userId, id: dbId });
        
        res.json({ 
            success: true, 
            taskId, 
            id: dbId,
            status: existing ? 'refreshing' : 'pending',
            message: existing ? 'Refresh task queued' : 'New competitor added, scraping started' 
        });
    } catch (error: any) {
        console.error('Add competitor failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete
router.delete('/:id', (req, res) => {
    try {
        // Delete related data first (though ON DELETE CASCADE should handle it, better to be explicit or safe)
        // SQLite supports CASCADE if enabled, but let's rely on schema definition.
        db.prepare('DELETE FROM competitors WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
