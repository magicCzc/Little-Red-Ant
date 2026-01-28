
import db from '../../db.js';
import { DataSanitizer } from '../../utils/DataSanitizer.js';

export class CompetitorService {
    static getById(id: number) {
        return db.prepare('SELECT * FROM competitors WHERE id = ?').get(id);
    }

    static getByUserId(userId: string) {
        return db.prepare('SELECT * FROM competitors WHERE user_id = ?').get(userId);
    }

    static updateStatus(id: number, status: string, error?: string) {
        db.prepare("UPDATE competitors SET status = ?, last_error = ? WHERE id = ?").run(status, error || null, id);
    }

    static saveScrapeResult(dbId: number, userId: string, info: any, normalizedNotes: any[], analysis: string) {
        // Parse stats
        let fans_count = 0;
        const parts = info.stats.split('|').map((s: string) => s.trim());
        for (const part of parts) {
             if (part.includes('粉丝')) {
                 fans_count = DataSanitizer.parseCount(part);
             }
        }
        
        const totalLikes = normalizedNotes.reduce((acc: number, cur: any) => acc + cur.likes, 0);

        let finalDbId = dbId;
        if (!finalDbId) {
             const existing = this.getByUserId(userId) as any;
             finalDbId = existing?.id;
        }

        db.transaction(() => {
            // 1. Upsert Competitor
            if (finalDbId) {
                db.prepare(`
                    UPDATE competitors 
                    SET nickname = ?, avatar = ?, latest_notes = ?, analysis_result = ?, 
                        fans_count = ?, notes_count = ?, status = 'active', last_error = NULL, 
                        last_updated = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `).run(
                    info.nickname, 
                    DataSanitizer.normalizeUrl(info.avatar), 
                    JSON.stringify(normalizedNotes), 
                    analysis, 
                    fans_count, 
                    normalizedNotes.length,
                    finalDbId
                );
            } else {
                const res = db.prepare(`
                    INSERT INTO competitors (user_id, nickname, avatar, latest_notes, analysis_result, fans_count, notes_count, status, last_updated)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
                `).run(
                    userId, info.nickname, DataSanitizer.normalizeUrl(info.avatar), 
                    JSON.stringify(normalizedNotes), analysis, fans_count, normalizedNotes.length
                );
                finalDbId = res.lastInsertRowid as number;
            }

            // 2. Insert Stats History
            db.prepare(`
                INSERT INTO competitor_stats_history (competitor_id, fans_count, notes_count, likes_count)
                VALUES (?, ?, ?, ?)
            `).run(finalDbId, fans_count, normalizedNotes.length, totalLikes);

            // 3. Sync Notes
            const getNoteId = (url: string) => {
                const match = url.match(/\/explore\/([a-zA-Z0-9]+)/);
                return match ? match[1] : null;
            };

            for (const note of normalizedNotes) {
                const noteId = note.note_id || getNoteId(note.url); // Use provided note_id if available
                if (!noteId) continue;

                const existingNote = db.prepare('SELECT id FROM competitor_notes WHERE competitor_id = ? AND note_id = ?').get(finalDbId, noteId) as any;

                if (existingNote) {
                    db.prepare(`
                        UPDATE competitor_notes 
                        SET title = ?, cover = ?, likes = ?, scraped_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(note.title, note.cover, note.likes, existingNote.id);
                    
                    db.prepare(`
                        INSERT INTO note_stats_history (note_id, competitor_id, likes, collects, comments)
                        VALUES (?, ?, ?, 0, 0)
                    `).run(noteId, finalDbId, note.likes);

                } else {
                    db.prepare(`
                        INSERT INTO competitor_notes (competitor_id, note_id, title, cover, url, likes, publish_date)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).run(finalDbId, noteId, note.title, note.cover, note.url, note.likes, note.publish_date || null);

                    db.prepare(`
                        INSERT INTO note_stats_history (note_id, competitor_id, likes, collects, comments)
                        VALUES (?, ?, ?, 0, 0)
                    `).run(noteId, finalDbId, note.likes);
                }
            }

        })();
        
        return { success: true, nickname: info.nickname, analysis, fans_count };
    }
}
