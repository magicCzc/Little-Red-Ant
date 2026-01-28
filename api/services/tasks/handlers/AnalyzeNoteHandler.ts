
import db from '../../../db.js';
import { ContentService } from '../../ai/ContentService.js';
import { scrapeNoteDetail } from '../../rpa/xiaohongshu.js';
import { TaskHandler } from '../TaskHandler.js';

export class AnalyzeNoteHandler implements TaskHandler {
    async handle(task: any): Promise<any> {
        const noteId = task.payload.noteId;
        console.log(`[Worker] Analyzing note ${noteId}...`);

        // 1. Get current note data
        let note = db.prepare('SELECT * FROM trending_notes WHERE note_id = ?').get(noteId) as any;
        
        // 2. If content missing, deep scrape
        if (!note || !note.content) {
            note = await this.deepScrape(noteId, note);
        }

        // 3. AI Analysis
        if (!note.content && !note.title) {
            throw new Error('无法获取笔记内容进行分析');
        }
        
        if (note.type === 'video' && !note.transcript) {
             if ((note.content || '').length < 50) {
                 throw new Error('视频笔记提取失败：无法获取视频字幕，且正文内容过短，无法进行深度分析。');
             }
        }

        let contentToAnalyze = note.content || note.title || '';
        if (note.transcript) {
            contentToAnalyze += `\n\n【视频口播文案 (Transcript)】\n${note.transcript}`;
        }

        const analysis = await ContentService.analyzeNoteStructure(
            contentToAnalyze, 
            note.title || '', 
            note.type || 'image',
            (note as any).videoFrames || [] 
        );
        
        // 4. Save Analysis
        db.prepare(`
            UPDATE trending_notes 
            SET analysis_result = ?
            WHERE note_id = ?
        `).run(JSON.stringify(analysis), noteId);

        return { noteId, analysis };
    }

    private async deepScrape(noteId: string, currentNote: any) {
        console.log(`[Worker] Content missing for ${noteId}, starting deep scrape...`);
        try {
            const noteInfo = db.prepare('SELECT note_url FROM trending_notes WHERE note_id = ?').get(noteId) as any;
            const targetIdOrUrl = (noteInfo && noteInfo.note_url && noteInfo.note_url.includes('xsec_token')) ? noteInfo.note_url : noteId;
            
            const activeAccount = db.prepare('SELECT id FROM accounts WHERE is_active = 1').get() as { id: number };
            const accountId = activeAccount ? activeAccount.id : undefined;

            const details = await scrapeNoteDetail(targetIdOrUrl, accountId);
            
            let videoFrames: string[] = [];
            
            if (details.is_video && details.likes_count > 100) {
                videoFrames = await this.processVideo(details);
            }

            // Update DB
            db.prepare(`
                UPDATE trending_notes 
                SET content = ?, tags = ?, created_at = ?,
                    likes_count = COALESCE(?, likes_count),
                    comments_count = COALESCE(?, comments_count),
                    collects_count = COALESCE(?, collects_count),
                    type = ?,
                    transcript = ?,
                    video_meta = ?
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
                noteId
            );
            
            const updatedNote = { ...currentNote, ...details, type: details.is_video ? 'video' : 'image' };
            (updatedNote as any).videoFrames = videoFrames;
            return updatedNote;

        } catch (scrapeError: any) {
            console.error(`[Worker] Failed to scrape note ${noteId}:`, scrapeError);
            if (scrapeError.message && (scrapeError.message.includes('ACCOUNT_BLOCKED') || scrapeError.message.includes('IP_BLOCKED') || scrapeError.message.includes('NOTE_UNAVAILABLE'))) {
                throw scrapeError;
            }
            throw new Error(`无法获取笔记详情: ${scrapeError.message}`);
        }
    }

    private async processVideo(details: any) {
        console.log(`[Worker] Video note detected (${details.likes_count} likes), starting deep video processing...`);
        try {
            if (details.video_url) {
                const { VideoProcessor } = await import('../../video/VideoProcessor.js');
                const processor = new VideoProcessor();
                const videoResult = await processor.processVideo(details.video_url);
                
                if (videoResult.transcript) {
                    details.transcript = videoResult.transcript;
                }
                
                if (videoResult.frames) {
                    return videoResult.frames;
                }
            }
        } catch (vpError) {
            console.error('[Worker] Video processing failed:', vpError);
        }
        return [];
    }
}
