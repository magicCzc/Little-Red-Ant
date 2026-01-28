
import { scrapeNoteStats } from '../../rpa/stats.js';
import { TaskHandler } from '../TaskHandler.js';

export class ScrapeStatsHandler implements TaskHandler {
    async handle(task: any): Promise<any> {
        return await scrapeNoteStats(task.id);
    }
}
