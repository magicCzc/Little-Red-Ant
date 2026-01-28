import { Router } from 'express';
import db from '../db.js';
import { enqueueTask } from '../services/queue.js';
import { AssetService } from '../services/asset/AssetService.js';

const router = Router();

// Helper to localize cover image
const localizeCover = async (note: any) => {
    if (!note.cover_url) return note;
    
    // Check if it needs localization (external http)
    if (note.cover_url.startsWith('http') && !note.cover_url.includes('localhost') && !note.cover_url.includes('/uploads/')) {
        try {
            const localUrl = await AssetService.downloadAndLocalize(note.cover_url, 'image');
            // Update DB
            db.prepare('UPDATE trending_notes SET cover_url = ? WHERE id = ?').run(localUrl, note.id);
            note.cover_url = localUrl;
        } catch (e) {
            console.warn(`Failed to localize cover for note ${note.id}:`, e);
        }
    }
    return note;
};

// Get list of trending notes
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;
        const sort = (req.query.sort as string) || 'scraped_at'; // 'likes_count', 'scraped_at'
        const category = req.query.category as string; // Optional category filter
        const search = req.query.search as string; // Optional search filter
        const date = req.query.date as string; // Optional date filter (YYYY-MM-DD)
        const analyzed = req.query.analyzed === 'true'; // Filter by analyzed status

        let orderBy = 'scraped_at DESC';
        if (sort === 'likes_count') orderBy = 'likes_count DESC';

        let query = 'SELECT * FROM trending_notes';
        let countQuery = 'SELECT COUNT(*) as count FROM trending_notes';
        const params: any[] = [];
        const whereConditions: string[] = [];

        if (category && category !== 'all') {
            whereConditions.push('category = ?');
            params.push(category);
        }

        if (analyzed) {
            whereConditions.push('analysis_result IS NOT NULL');
        }

        // Filter out low quality notes by default if not sorting by scraped_at
        // Or just let the sort handle it.
        // Let's filter out < 10 likes just to be safe from garbage data
        // whereConditions.push('likes_count >= 10');

        if (search) {
            whereConditions.push('(title LIKE ? OR content LIKE ? OR author_name LIKE ?)');
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        if (date) {
            whereConditions.push('scraped_at LIKE ?');
            params.push(`${date}%`);
        }

        if (whereConditions.length > 0) {
            const whereClause = ' WHERE ' + whereConditions.join(' AND ');
            query += whereClause;
            countQuery += whereClause;
        }

        // Always sort by likes_count DESC if user didn't specify otherwise
        // Or if sort is 'scraped_at', maybe secondary sort by likes?
        if (sort === 'scraped_at') {
            // Even when sorting by time, we prefer hot notes within that time
            // But strict time sort is useful for "breaking news"
            query += ` ORDER BY scraped_at DESC LIMIT ? OFFSET ?`;
        } else {
            query += ` ORDER BY likes_count DESC LIMIT ? OFFSET ?`;
        }
        
        const notes = db.prepare(query).all(...params, limit, offset);
        const total = db.prepare(countQuery).get(...params) as { count: number };

        // Async localize covers for the current page
        // FIRE AND FORGET: Don't await, let it run in background to keep UI snappy.
        // The images might be broken initially, but will fix themselves on next refresh/render.
        // Ideally we should use a placeholder or check status, but for now speed is priority.
        Promise.all(notes.map(n => localizeCover(n))).catch(e => console.error('Background localization failed', e));

        res.json({
            data: notes.map((n: any) => ({
                ...n,
                tags: n.tags ? JSON.parse(n.tags) : [],
                analysis_result: n.analysis_result ? JSON.parse(n.analysis_result) : null
            })),
            pagination: {
                page,
                limit,
                total: total.count,
                totalPages: Math.ceil(total.count / limit)
            }
        });
    } catch (error: any) {
        console.error('Error fetching trending notes:', error);
        res.status(500).json({ error: error.message });
    }
});

// Import note from competitor to trending (for analysis)
router.post('/import', (req, res) => {
    try {
        const { note_id, title, cover_url, author_name, likes_count, note_url, type, video_url } = req.body;
        
        // Check if exists
        const existing = db.prepare('SELECT id FROM trending_notes WHERE note_id = ?').get(note_id) as any;
        
        if (existing) {
            return res.json({ success: true, id: existing.id, message: 'Note already exists' });
        }

        // Insert
        const result = db.prepare(`
            INSERT INTO trending_notes (
                note_id, title, cover_url, author_name, likes_count, 
                note_url, type, video_url, scraped_at, category
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'competitor_import')
        `).run(
            note_id, 
            title || 'Untitled', 
            cover_url || '', 
            author_name || 'Unknown', 
            likes_count || 0, 
            note_url || '', 
            type || 'image', 
            video_url || null
        );

        res.json({ success: true, id: result.lastInsertRowid, message: 'Note imported' });
    } catch (error: any) {
        console.error('Import note failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Trigger scrape for trending notes
router.post('/scrape', async (req, res) => {
    try {
        const { category } = req.body;
        // Enqueue scraping task
        const taskId = enqueueTask('SCRAPE_TRENDS', { 
            source: 'xiaohongshu', 
            type: 'notes',
            category: category || 'recommend' 
        });
        res.json({ message: 'Scraping task started', taskId });
    } catch (error: any) {
        console.error('Error starting scrape:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single note details
router.get('/:id', (req, res) => {
    try {
        const note = db.prepare('SELECT * FROM trending_notes WHERE id = ?').get(req.params.id) as any;
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        res.json({
            ...note,
            tags: note.tags ? JSON.parse(note.tags) : [],
            analysis_result: note.analysis_result ? JSON.parse(note.analysis_result) : null
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Trigger analysis for a note
router.post('/:id/analyze', async (req, res) => {
    try {
        const noteId = req.params.id; // note_id (string) not the DB integer id
        // Or if we use DB ID, we should lookup note_id.
        // The gallery uses DB ID (id) but stores note_id. 
        // Let's assume the frontend passes the DB ID for consistency, and we look up the note_id.
        
        // Actually, gallery has note.note_id. Let's support note_id directly if possible, or lookup.
        // Let's check if param looks like an integer.
        
        let targetNoteId = noteId;
        if (/^\d+$/.test(noteId)) {
            // It's likely a DB ID, fetch the note_id
            const note = db.prepare('SELECT note_id FROM trending_notes WHERE id = ?').get(noteId) as any;
            if (note) targetNoteId = note.note_id;
        }

        // Check if already analyzed
        const existing = db.prepare('SELECT analysis_result FROM trending_notes WHERE note_id = ?').get(targetNoteId) as any;
        if (existing && existing.analysis_result) {
            return res.json({ 
                status: 'COMPLETED', 
                result: JSON.parse(existing.analysis_result) 
            });
        }

        // Enqueue task
        const taskId = enqueueTask('ANALYZE_NOTE', { noteId: targetNoteId });
        res.json({ message: 'Analysis started', taskId, status: 'PENDING' });
    } catch (error: any) {
        console.error('Error starting analysis:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete note
router.delete('/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM trending_notes WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Batch delete notes
router.post('/batch-delete', (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Invalid ids provided' });
        }

        const placeholders = ids.map(() => '?').join(',');
        db.prepare(`DELETE FROM trending_notes WHERE id IN (${placeholders})`).run(...ids);
        
        res.json({ success: true, count: ids.length });
    } catch (error: any) {
        console.error('Batch delete failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Refresh note (Force re-scrape)
router.post('/:id/refresh', async (req, res) => {
    try {
        const note = db.prepare('SELECT note_id FROM trending_notes WHERE id = ?').get(req.params.id) as any;
        if (!note) return res.status(404).json({ error: 'Note not found' });
        
        // Clear content to force re-scrape in worker
        db.prepare('UPDATE trending_notes SET content = NULL WHERE id = ?').run(req.params.id);
        
        const taskId = enqueueTask('ANALYZE_NOTE', { noteId: note.note_id });
        res.json({ success: true, taskId, message: 'Refresh started' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
