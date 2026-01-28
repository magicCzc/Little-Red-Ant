
import { scrapeCompetitor } from '../../rpa/competitor.js';
import { TaskHandler } from '../TaskHandler.js';

export class ScrapeCompetitorHandler implements TaskHandler {
    async handle(task: any): Promise<any> {
        // Pass the entire payload which includes { url, id }
        return await scrapeCompetitor(task.payload);
    }
}
