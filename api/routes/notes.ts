import express from 'express';
import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get list of managed notes
router.get('/', (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 10;
        const accountId = req.query.accountId;
        
        console.log(`[API] Get Notes - Page: ${page}, AccountId: ${accountId}, Keyword: ${req.query.keyword}`);
        
        const status = req.query.status; // 'PUBLISHED', 'DELETED', etc. (Currently we don't track DELETED in note_stats, maybe add it?)
        
        const offset = (page - 1) * pageSize;
        
        let query = `
            SELECT 
                ns.*, 
                a.nickname as account_name, 
                a.avatar as account_avatar,
                vp.id as project_id,
                vp.title as project_title
            FROM note_stats ns
            LEFT JOIN accounts a ON ns.account_id = a.id
            LEFT JOIN video_projects vp ON ns.note_id = vp.note_id
            WHERE 1=1
        `;
        
        const params: any[] = [];
        
        if (accountId) {
            query += ` AND ns.account_id = ?`;
            params.push(accountId);
        }

        // Search by title
        if (req.query.keyword) {
            query += ` AND ns.title LIKE ?`;
            params.push(`%${req.query.keyword}%`);
        }
        
        query += ` ORDER BY ns.publish_date DESC LIMIT ? OFFSET ?`;
        params.push(pageSize, offset);
        
        const notes = db.prepare(query).all(...params);
        console.log(`[API] Get Notes - Found ${notes.length} records`);
        
        // Count total
        let countQuery = `SELECT COUNT(*) as total FROM note_stats ns WHERE 1=1`;
        const countParams: any[] = [];
        
        if (accountId) {
            countQuery += ` AND ns.account_id = ?`;
            countParams.push(accountId);
        }
        if (req.query.keyword) {
            countQuery += ` AND ns.title LIKE ?`;
            countParams.push(`%${req.query.keyword}%`);
        }
        
        const total = (db.prepare(countQuery).get(...countParams) as any).total;
        
        res.json({
            success: true,
            data: notes,
            total,
            page,
            pageSize
        });
    } catch (error) {
        console.error('Get notes failed:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

import { FileCleanupService } from '../services/core/FileCleanupService.js';

// Delete a note (Create Task)
router.delete('/:id', async (req, res) => {
    try {
        const noteId = req.params.id;
        const { accountId } = req.body; // Need account ID to know which cookies to use

        if (!accountId) {
            // Try to find account_id from note_stats
            const note = db.prepare('SELECT account_id FROM note_stats WHERE note_id = ?').get(noteId) as any;
            if (!note) {
                return res.status(404).json({ success: false, error: 'Note not found' });
            }
        }
        
        // 1. Clean up local files (cover_image)
        const noteRecord = db.prepare('SELECT cover_image FROM note_stats WHERE note_id = ?').get(noteId) as any;
        if (noteRecord && noteRecord.cover_image) {
             await FileCleanupService.deleteFiles([noteRecord.cover_image]);
        }

        // Since we don't have DELETE_NOTE RPA yet, we will just delete from local DB for now
        // and tell user "Local record deleted".
        // TODO: Implement RPA Delete
        
        db.prepare('DELETE FROM note_stats WHERE note_id = ?').run(noteId);
        
        res.json({ success: true, message: 'Local record deleted' });
    } catch (error) {
        console.error('Delete note failed:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

export default router;
