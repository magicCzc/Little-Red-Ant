
import db from '../../../db.js';
import { openPublishPageWithContent } from '../../rpa/publish.js';
import { VideoProjectService } from '../../video/VideoProjectService.js';
import { TaskHandler } from '../TaskHandler.js';

export class PublishHandler implements TaskHandler {
    async handle(task: any): Promise<any> {
        // payload: { title, content, tags, imageData, autoPublish, accountId }
        let publishPayload = task.payload;
        
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
        
        // 4. Update Video Project Status (if applicable)
        if (publishPayload.projectId) {
            VideoProjectService.updateProjectStatus(publishPayload.projectId, 'COMPLETED', undefined, 'PUBLISHED');
        }

        return result;
    }
}
