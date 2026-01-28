import { Router } from 'express';
import * as XLSX from 'xlsx';
import db from '../db.js';
import { enqueueTask } from '../services/queue.js';

const router = Router();

// Get Summary Stats
router.get('/summary', (req, res) => {
  try {
    // Get Active Account
    const activeAccount = db.prepare('SELECT id, nickname FROM accounts WHERE is_active = 1').get() as { id: number, nickname: string } | undefined;
    
    if (!activeAccount) {
        return res.json({
            account_name: 'No Active Account',
            total_notes: 0,
            total_views: 0,
            total_likes: 0,
            total_comments: 0,
            total_collects: 0
        });
    }

    // Check if we have data for this account
    const totalNotes = db.prepare('SELECT COUNT(*) as count FROM note_stats WHERE account_id = ?').get(activeAccount.id) as { count: number };
    
    const sums = db.prepare(`
        SELECT 
            SUM(views) as total_views, 
            SUM(likes) as total_likes, 
            SUM(comments) as total_comments, 
            SUM(collects) as total_collects 
        FROM note_stats
        WHERE account_id = ?
    `).get(activeAccount.id) as any;

    res.json({
        account_name: activeAccount.nickname,
        total_notes: totalNotes.count,
        total_views: sums.total_views || 0,
        total_likes: sums.total_likes || 0,
        total_comments: sums.total_comments || 0,
        total_collects: sums.total_collects || 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Note List with Pagination
router.get('/notes', (req, res) => {
  try {
    const activeAccount = db.prepare('SELECT id FROM accounts WHERE is_active = 1').get() as { id: number } | undefined;
    
    if (!activeAccount) {
        return res.json({
            data: [],
            total: 0,
            page: 1,
            pageSize: 10
        });
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const offset = (page - 1) * pageSize;

    const notes = db.prepare('SELECT * FROM note_stats WHERE account_id = ? ORDER BY record_date DESC LIMIT ? OFFSET ?')
        .all(activeAccount.id, pageSize, offset);
        
    const countResult = db.prepare('SELECT COUNT(*) as count FROM note_stats WHERE account_id = ?').get(activeAccount.id) as { count: number };
    
    res.json({
        data: notes,
        total: countResult.count,
        page,
        pageSize
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger Refresh (Async Scrape Task)
router.post('/refresh', async (req, res) => {
  try {
    const taskId = enqueueTask('SCRAPE_STATS', {});
    res.json({ success: true, taskId, message: 'Scrape task queued' });
  } catch (error: any) {
    console.error('Refresh failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get History Trend
router.get('/history', (req, res) => {
    try {
        const activeAccount = db.prepare('SELECT id FROM accounts WHERE is_active = 1').get() as { id: number } | undefined;
        if (!activeAccount) return res.json([]);

        // Aggregated history by date for the active account
        // We use a CTE to get the latest snapshot for EACH note on EACH day
        // Then we sum them up to get the daily total for the account
        const history = db.prepare(`
            WITH DailyLatest AS (
                SELECT 
                    note_id, 
                    views, 
                    likes, 
                    comments, 
                    collects,
                    date(record_time) as record_date,
                    ROW_NUMBER() OVER (PARTITION BY note_id, date(record_time) ORDER BY record_time DESC) as rn
                FROM note_stats_history
                WHERE record_time > datetime('now', '-30 days')
            )
            SELECT 
                DailyLatest.record_date as date,
                SUM(DailyLatest.views) as views,
                SUM(DailyLatest.likes) as likes,
                SUM(DailyLatest.comments) as comments,
                SUM(DailyLatest.collects) as collects,
                (SUM(DailyLatest.likes) + SUM(DailyLatest.comments) + SUM(DailyLatest.collects)) as interaction
            FROM DailyLatest
            JOIN note_stats n ON DailyLatest.note_id = n.note_id
            WHERE DailyLatest.rn = 1 
            AND n.account_id = ?
            GROUP BY DailyLatest.record_date
            ORDER BY DailyLatest.record_date ASC
        `).all(activeAccount.id);

        res.json(history);
    } catch (error: any) {
        console.error('History fetch failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Engagement Analysis (Comments & Intents)
router.get('/engagement', (req, res) => {
    try {
        const activeAccount = db.prepare('SELECT id FROM accounts WHERE is_active = 1').get() as { id: number } | undefined;
        if (!activeAccount) return res.json({});

        // 1. Intent Distribution
        const intents = db.prepare(`
            SELECT intent, COUNT(*) as count 
            FROM comments 
            WHERE account_id = ? AND intent IS NOT NULL
            GROUP BY intent
        `).all(activeAccount.id) as { intent: string, count: number }[];

        const intentMap = {
            PRAISE: 0,
            COMPLAINT: 0,
            INQUIRY: 0,
            OTHER: 0
        };

        intents.forEach(i => {
            if (i.intent in intentMap) {
                intentMap[i.intent as keyof typeof intentMap] = i.count;
            }
        });

        // 2. Reply Rate
        const replyStats = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN reply_status = 'REPLIED' THEN 1 ELSE 0 END) as replied
            FROM comments
            WHERE account_id = ?
        `).get(activeAccount.id) as { total: number, replied: number };

        // 3. Daily Comment Trend (Last 7 Days)
        const dailyComments = db.prepare(`
            SELECT strftime('%Y-%m-%d', create_time) as date, COUNT(*) as count
            FROM comments
            WHERE account_id = ? AND create_time > datetime('now', '-7 days')
            GROUP BY date
            ORDER BY date ASC
        `).all(activeAccount.id) as { date: string, count: number }[];

        res.json({
            intents: intentMap,
            replyStats: {
                total: replyStats.total,
                replied: replyStats.replied,
                rate: replyStats.total > 0 ? Math.round((replyStats.replied / replyStats.total) * 100) : 0
            },
            dailyTrend: dailyComments
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Export Data to Excel
router.get('/export', (req, res) => {
    try {
        const activeAccount = db.prepare('SELECT id, nickname FROM accounts WHERE is_active = 1').get() as { id: number, nickname: string } | undefined;
        
        if (!activeAccount) {
            return res.status(404).json({ error: 'No active account found' });
        }

        const notes = db.prepare(`
            SELECT 
                title as '笔记标题',
                views as '阅读量',
                likes as '点赞数',
                collects as '收藏数',
                comments as '评论数',
                publish_date as '发布时间',
                record_date as '最后更新时间'
            FROM note_stats 
            WHERE account_id = ? 
            ORDER BY publish_date DESC
        `).all(activeAccount.id);

        if (notes.length === 0) {
            return res.status(400).json({ error: 'No data to export' });
        }

        // Create Workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(notes);
        
        // Auto-width (simplified)
        const colWidths = [
            { wch: 40 }, // Title
            { wch: 10 }, // Views
            { wch: 10 }, // Likes
            { wch: 10 }, // Collects
            { wch: 10 }, // Comments
            { wch: 20 }, // Publish Date
            { wch: 20 }  // Update Time
        ];
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, "Notes Data");

        // Generate Buffer
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Set Headers
        res.setHeader('Content-Disposition', `attachment; filename="XiaoHongShu_Data_${encodeURIComponent(activeAccount.nickname)}_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        res.send(buf);

    } catch (error: any) {
        console.error('Export failed:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
