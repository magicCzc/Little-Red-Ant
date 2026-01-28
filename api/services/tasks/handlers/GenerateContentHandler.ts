
import db from '../../../db.js';
import { ContentService } from '../../ai/ContentService.js';
import { TaskHandler } from '../TaskHandler.js';

export class GenerateContentHandler implements TaskHandler {
    async handle(task: any): Promise<any> {
        // 1. Try to find Account (New Persona System)
        let account;
        if (task.payload.accountId) {
            account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(task.payload.accountId);
        } else {
            account = db.prepare('SELECT * FROM accounts WHERE is_active = 1').get();
        }

        if (account) {
            console.log(`[Worker] Generating content using Account Persona: ${account.nickname}`);
            return await ContentService.generateNote({
                niche: account.niche || '通用',
                identity_tags: [],
                style: task.payload.style || account.tone || '亲切自然',
                topic: task.payload.topic,
                keywords: task.payload.keywords,
                remix_structure: task.payload.remix_structure,
                contentType: task.payload.contentType,
                persona_desc: account.persona_desc,
                writing_samples: account.writing_sample ? [account.writing_sample] : []
            });
        } else {
            // 2. Fallback to Legacy User Profile
            console.log('[Worker] No active account found, falling back to legacy User Profile...');
            let user = db.prepare('SELECT * FROM users WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1').get();
            if (!user) {
                user = db.prepare('SELECT * FROM users ORDER BY id DESC LIMIT 1').get();
            }
            
            if (!user) throw new Error('No account or user profile found. Please configure a persona in Account Management.');
            
            const userProfile = {
                niche: (user as any).niche,
                identity_tags: JSON.parse((user as any).identity_tags as string || '[]'),
                style: task.payload.style || (user as any).style,
                writing_samples: JSON.parse((user as any).writing_samples as string || '[]'),
            };
            
            return await ContentService.generateNote({
                ...userProfile,
                topic: task.payload.topic,
                keywords: task.payload.keywords,
                remix_structure: task.payload.remix_structure,
                contentType: task.payload.contentType
            });
        }
    }
}
