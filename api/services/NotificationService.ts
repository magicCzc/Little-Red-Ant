import db from '../db.js';

export interface Notification {
    id: number;
    type: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO';
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

export class NotificationService {
    static getNotifications(limit: number = 20, offset: number = 0) {
        return db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset) as Notification[];
    }

    static getUnreadCount() {
        const res = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get() as { count: number };
        return res.count;
    }

    static create(type: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO', title: string, message: string) {
        return db.prepare('INSERT INTO notifications (type, title, message) VALUES (?, ?, ?)').run(type, title, message);
    }

    static markAsRead(id: number) {
        return db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    }

    static markAllAsRead() {
        return db.prepare('UPDATE notifications SET is_read = 1').run();
    }
}
