
import { scrapeNoteStats } from '../../rpa/stats.js';
import { TaskHandler } from '../TaskHandler.js';
import { FeedbackLoopService } from '../../ai/FeedbackLoopService.js';
import { Logger } from '../../LoggerService.js';

export class ScrapeStatsHandler implements TaskHandler {
    async handle(task: any): Promise<any> {
        const result = await scrapeNoteStats(task.id);
        
        // Auto-trigger Feedback Loop after stats update
        try {
            Logger.info('TaskHandler', 'Triggering AI Feedback Loop after manual stats sync...');
            await FeedbackLoopService.runCycle();
        } catch (e: any) {
            Logger.error('TaskHandler', `Feedback Loop failed: ${e.message}`);
        }

        return result;
    }
}
