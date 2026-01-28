import express from 'express';
import { NotificationService } from '../services/NotificationService.js';

const router = express.Router();

// Get list
router.get('/', (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;
        const notifications = NotificationService.getNotifications(limit, offset);
        res.json(notifications);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get unread count
router.get('/unread-count', (req, res) => {
    try {
        const count = NotificationService.getUnreadCount();
        res.json({ count });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Mark as read
router.put('/:id/read', (req, res) => {
    try {
        NotificationService.markAsRead(parseInt(req.params.id));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Mark all as read
router.put('/read-all', (req, res) => {
    try {
        NotificationService.markAllAsRead();
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
