
import { scrapeComments } from '../../rpa/comments.js';
import { TaskHandler } from '../TaskHandler.js';

export class ScrapeCommentsHandler implements TaskHandler {
    async handle(task: any): Promise<any> {
        return await scrapeComments();
    }
}
