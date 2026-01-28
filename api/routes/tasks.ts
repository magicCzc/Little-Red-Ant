import { Router } from 'express';
import { getTask, enqueueTask, cancelTask } from '../services/queue.js';
import db from '../db.js';

const router = Router();

// Get Active Tasks (For Real-time Monitoring)
router.get('/active', (req, res) => {
    try {
        const tasks = db.prepare(`
            SELECT * FROM tasks 
            WHERE status IN ('PENDING', 'PROCESSING')
            ORDER BY created_at DESC
        `).all();
        
        res.json(tasks.map(task => ({
            ...task,
            payload: JSON.parse(task.payload),
            result: task.result ? JSON.parse(task.result) : undefined
        })));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get Task Stats
router.get('/stats', (req, res) => {
    try {
        const stats = db.prepare(`
            SELECT 
                SUM(CASE WHEN status = 'PENDING' OR status = 'PROCESSING' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
            FROM tasks
        `).get() as any;
        
        res.json({
            pending: stats.pending || 0,
            failed: stats.failed || 0,
            completed: stats.completed || 0
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// List Tasks (Recent or Range)
router.get('/', (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 20;
        const offset = (page - 1) * pageSize;
        
        const startDate = req.query.start_date as string;
        const endDate = req.query.end_date as string;
        
        // Optional: Filter by type or status
        // const type = req.query.type as string;

        let tasks;
        let totalCount = 0;

        if (startDate && endDate) {
            // Calendar Mode: Get all tasks within range (limit 1000 to be safe)
            // Logic: Filter by scheduled_at if present, else created_at
            tasks = db.prepare(`
                SELECT * FROM tasks 
                WHERE (scheduled_at BETWEEN ? AND ?) 
                   OR (scheduled_at IS NULL AND created_at BETWEEN ? AND ?)
                ORDER BY created_at DESC
                LIMIT 1000
            `).all(startDate, endDate, startDate, endDate);
            
            totalCount = tasks.length;
        } else {
            // Pagination Mode
            const total = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
            totalCount = total.count;
            
            tasks = db.prepare(`
                SELECT * FROM tasks 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            `).all(pageSize, offset);
        }
        
        res.json({
            data: tasks.map(task => ({
                ...task,
                payload: JSON.parse(task.payload),
                result: task.result ? JSON.parse(task.result) : undefined
            })),
            pagination: {
                total: totalCount,
                page,
                pageSize: startDate ? totalCount : pageSize, // If calendar mode, pageSize is effectively total
                totalPages: startDate ? 1 : Math.ceil(totalCount / pageSize)
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get Single Task
router.get('/:id', (req, res) => {
    try {
        const task = getTask(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Cancel Task
router.post('/:id/cancel', (req, res) => {
    try {
        const success = cancelTask(req.params.id);
        if (success) {
            res.json({ success: true, message: 'Task cancelled successfully' });
        } else {
            res.status(400).json({ error: 'Task could not be cancelled (not pending/processing or not found)' });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update Task Status
router.put('/:id/status', (req, res) => {
    try {
        const { status, result, error } = req.body;
        
        db.prepare(`
            UPDATE tasks 
            SET status = ?, result = ?, error = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(status, result ? JSON.stringify(result) : null, error || null, req.params.id);
        
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;