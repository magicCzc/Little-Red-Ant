
import db from '../../../db.js';
import { openPublishPageWithContent } from '../../rpa/publish.js';
import { VideoProjectService } from '../../video/VideoProjectService.js';
import { TaskHandler } from '../TaskHandler.js';

import { ComplianceService } from '../../core/ComplianceService.js';
import { Logger } from '../../LoggerService.js';

export class PublishHandler implements TaskHandler {
    async handle(task: any): Promise<any> {
        // payload: { title, content, tags, imageData, autoPublish, accountId }
        let publishPayload = task.payload;
        
        // 0. Compliance Check (The Gatekeeper)
        // Ensure content is safe before proceeding
        const fullText = `${publishPayload.title}\n${publishPayload.content}`;
        const complianceResult = ComplianceService.check(fullText);
        
        if (!complianceResult.isCompliant) {
            const errorMsg = `Content blocked by Compliance Service. Blocked words: ${complianceResult.blockedWords.join(', ')}`;
            Logger.warn('PublishHandler', errorMsg);
            throw new Error(errorMsg); // Hard Block
        }
        
        if (complianceResult.score < 60) {
             const warningMsg = `Content risk score too low (${complianceResult.score}). Please review before publishing.`;
             Logger.warn('PublishHandler', warningMsg);
             throw new Error(warningMsg); // Soft Block (Quality Control)
        }

        // 1. Resolve Account ID
        if (!publishPayload.accountId) {
            const active = db.prepare('SELECT id FROM accounts WHERE is_active = 1').get() as { id: number };
            if (active) publishPayload.accountId = active.id;
        }
        
        // 2. Check Daily Limit (Safety)
        if (publishPayload.accountId) {
            const todayStart = new Date();
            todayStart.setHours(0,0,0,0);
            const todayStr = todayStart.toISOString();
            
            const dailyCount = db.prepare(`
                SELECT COUNT(*) as count FROM tasks 
                WHERE type = 'PUBLISH' 
                AND status = 'COMPLETED' 
                AND updated_at >= ?
                AND json_extract(payload, '$.accountId') = ?
            `).get(todayStr, publishPayload.accountId) as { count: number };
            
            const DAILY_LIMIT = 5; 
            
            if (dailyCount.count >= DAILY_LIMIT) {
                throw new Error(`Daily publish limit (${DAILY_LIMIT}) reached for account ${publishPayload.accountId}. Safety protection triggered.`);
            }
        }

        // 3. Execute RPA
        const result = await openPublishPageWithContent(publishPayload, task.id);
        
        // 4. Post-Publish Updates
        if (result.success && result.noteId) {
            // Update Draft if exists
            if (publishPayload.draftId) {
                try {
                    db.prepare('UPDATE drafts SET published_note_id = ?, published_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                      .run(result.noteId, result.noteUrl || '', publishPayload.draftId);
                } catch (e) {
                    console.error('Failed to update draft with published info', e);
                }
            }

            // Update Video Project Status (if applicable)
            if (publishPayload.projectId) {
                // Also update note_id in video_projects if column exists (it should now)
                try {
                    db.prepare('UPDATE video_projects SET note_id = ? WHERE id = ?').run(result.noteId, publishPayload.projectId);
                } catch (e) {}
            }
        }

        // 5. Update Video Project Status (General)
        if (publishPayload.projectId) {
            VideoProjectService.updateProjectStatus(publishPayload.projectId, 'COMPLETED', undefined, 'PUBLISHED');
        }

        return result;
    }
}
