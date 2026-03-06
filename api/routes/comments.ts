
import { Router } from 'express';
import { scrapeComments, replyToComment } from '../services/rpa/comments.js';
import { enqueueTask } from '../services/queue.js';
import db from '../db.js';

const router = Router();

// Get Comments from DB
router.get('/', (req, res) => {
    try {
        const { status, page = 1, pageSize = 20, accountId } = req.query;
        const limit = Number(pageSize);
        const offset = (Number(page) - 1) * limit;

        const whereClauses: string[] = [];
        const params: (string | number)[] = [];

        // 1. Filter by Status
        if (status && status !== 'ALL') {
            whereClauses.push('reply_status = ?');
            params.push(status);
        }

        // 2. Filter by Account
        // If accountId is provided, use it.
        // If NOT provided, use the currently ACTIVE account (User's requirement: "follow the account")
        let targetAccountId: any = accountId;
        
        if (!targetAccountId) {
            const activeAccount = db.prepare('SELECT id FROM accounts WHERE is_active = 1').get() as { id: number };
            if (activeAccount) {
                targetAccountId = activeAccount.id;
            }
        }

        if (targetAccountId) {
            whereClauses.push('account_id = ?');
            params.push(targetAccountId);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Get Data
        const comments = db.prepare(`
            SELECT * FROM comments 
            ${whereSql} 
            ORDER BY create_time DESC 
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        // Get Total Count
        const countResult = db.prepare(`
            SELECT COUNT(*) as count FROM comments 
            ${whereSql}
        `).get(...params) as { count: number };

        res.json({ 
            success: true, 
            data: comments,
            pagination: {
                total: countResult.count,
                page: Number(page),
                pageSize: limit,
                totalPages: Math.ceil(countResult.count / limit)
            },
            activeAccountId: targetAccountId // Return this so frontend knows which account context is used
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Trigger Scrape (Async)
router.post('/scrape', async (req, res) => {
    try {
        // Enqueue Task
        const taskId = enqueueTask('SCRAPE_COMMENTS', {});
        res.json({ taskId, status: 'PENDING', message: 'Scrape task queued' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Reply to Comment
router.post('/reply', async (req, res) => {
    const { commentId, content } = req.body;
    if (!commentId || !content) return res.status(400).json({ error: 'Missing params' });

    try {
        const result = await replyToComment(commentId, content);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
