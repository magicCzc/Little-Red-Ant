import db from '../../db.js';
import { SettingsService } from '../SettingsService.js';
import { Logger } from '../LoggerService.js';

export class TrendService {
    // Static initializer for schema migration (Lazy)
    static {
        try {
            db.prepare('ALTER TABLE trending_notes ADD COLUMN images TEXT').run();
            Logger.info('TrendService', 'Schema migration: Added images column');
        } catch (e: any) {
            // Ignore duplicate column error
            if (!e.message.includes('duplicate column')) {
                // Logger.warn('TrendService', 'Schema migration check failed', e);
            }
        }
    }

    /**
     * Save or Update trending notes from scraping results
     */
    static async saveTrends(notes: any[], category: string, platform: string = 'xiaohongshu') {
        if (!notes || notes.length === 0) return;

        const insertNote = db.prepare(`
            INSERT INTO trending_notes (
                platform, note_id, title, content, author_name, cover_url, 
                note_url, likes_count, comments_count, collects_count, scraped_at, category, type, images
            ) VALUES (
                @platform, @note_id, @title, @content, @author, @cover, 
                @url, @heat, @comments, @collects, CURRENT_TIMESTAMP, @category, @type, @images
            )
            ON CONFLICT(note_id) DO UPDATE SET
            likes_count = @heat,
            comments_count = @comments,
            collects_count = @collects,
            cover_url = excluded.cover_url,
            note_url = excluded.note_url,
            title = excluded.title,
            content = COALESCE(excluded.content, content),
            author_name = excluded.author_name,
            scraped_at = CURRENT_TIMESTAMP,
            category = excluded.category,
            type = excluded.type,
            images = COALESCE(excluded.images, images)
        `);

        // Transaction for batch insert
        const transaction = db.transaction((notesToInsert) => {
            for (const note of notesToInsert) {
                let noteId = note.url;
                const noteIdMatch = note.url.match(/\/(explore|discovery\/item)\/([a-zA-Z0-9]+)/);
                if (noteIdMatch && noteIdMatch[2]) {
                    noteId = noteIdMatch[2];
                }

                try {
                    insertNote.run({
                        platform,
                        note_id: noteId,
                        title: note.title,
                        content: note.summary || '',
                        author: note.author,
                        cover: note.cover,
                        url: note.url,
                        heat: note.heat,
                        comments: note.comments || 0,
                        collects: note.collects || 0,
                        category: category,
                        type: note.is_video ? 'video' : 'image',
                        images: note.images ? JSON.stringify(note.images) : null
                    });
                } catch (e) {
                    Logger.error('TrendService', `Failed to insert note: ${note.title}`, e);
                }
            }
        });

        transaction(notes);
        Logger.info('TrendService', `Saved ${notes.length} trends for category: ${category}`);
    }

    /**
     * Get a note by ID
     */
    static getNoteById(noteId: string) {
        return db.prepare('SELECT * FROM trending_notes WHERE note_id = ?').get(noteId) as any;
    }

    /**
     * Update detailed note information after deep scraping
     */
    static updateNoteDetails(noteId: string, details: any, videoFrames: string[] = []) {
        db.prepare(`
            UPDATE trending_notes 
            SET content = ?, tags = ?, created_at = ?,
                likes_count = COALESCE(?, likes_count),
                comments_count = COALESCE(?, comments_count),
                collects_count = COALESCE(?, collects_count),
                type = ?,
                transcript = ?,
                video_meta = ?,
                images = ?
            WHERE note_id = ?
        `).run(
            details.content, 
            JSON.stringify(details.tags), 
            details.date || new Date().toISOString(),
            details.likes_count,
            details.comments_count,
            details.collects_count,
            details.is_video ? 'video' : 'image',
            details.transcript || null,
            details.video_meta ? JSON.stringify(details.video_meta) : null,
            details.images ? JSON.stringify(details.images) : null,
            noteId
        );
        
        Logger.info('TrendService', `Updated details for note: ${noteId}`);
        return { ...details, videoFrames };
    }

    /**
     * Save AI Analysis result
     */
    static saveAnalysisResult(noteId: string, analysis: any) {
        db.prepare(`
            UPDATE trending_notes 
            SET analysis_result = ?
            WHERE note_id = ?
        `).run(JSON.stringify(analysis), noteId);
        Logger.info('TrendService', `Saved analysis for note: ${noteId}`);
    }

    /**
     * Check for viral notes and return candidates for auto-analysis
     */
    static async getViralNotesCandidates(notes: any[]) {
        // Load config
        const enabled = await SettingsService.get('AUTO_ANALYZE_ENABLED');
        if (enabled !== 'true') return [];

        const thresholdStr = await SettingsService.get('AUTO_ANALYZE_THRESHOLD');
        const limitStr = await SettingsService.get('AUTO_ANALYZE_LIMIT_PER_BATCH');

        const VIRAL_THRESHOLD = thresholdStr ? parseInt(thresholdStr) : 100000; 
        const MAX_PER_BATCH = limitStr ? parseInt(limitStr) : 3; 
        
        const viralNotes = notes.filter(n => n.heat >= VIRAL_THRESHOLD);
        
        if (viralNotes.length === 0) return [];

        Logger.info('TrendService', `Found ${viralNotes.length} viral notes (>${VIRAL_THRESHOLD}). Checking for candidates...`);

        // Limit the number of analyses per batch
        const targetNotes = viralNotes.slice(0, MAX_PER_BATCH);
        const candidates = [];

        for (const note of targetNotes) {
            let noteId = note.url;
            const noteIdMatch = note.url.match(/\/(explore|discovery\/item)\/([a-zA-Z0-9]+)/);
            if (noteIdMatch && noteIdMatch[2]) {
                noteId = noteIdMatch[2];
            }

            // Check if already analyzed
            const existing = this.getNoteById(noteId);
            if (existing && existing.analysis_result) continue;

            candidates.push({
                noteId,
                title: note.title
            });
        }
        
        return candidates;
    }

    /**
     * Save external trends (Weibo, etc.)
     */
    static saveExternalTrends(source: string, trends: any[]) {
         db.prepare(`
            INSERT INTO trends (source, data, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(source) DO UPDATE SET 
            data = excluded.data,
            updated_at = CURRENT_TIMESTAMP
        `).run(source, JSON.stringify(trends));
        Logger.info('TrendService', `Saved external trends for: ${source}`);
    }
}
