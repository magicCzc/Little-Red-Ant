
import { TaskHandler } from './TaskHandler.js';
import { PublishHandler } from './handlers/PublishHandler.js';
import { ScrapeStatsHandler } from './handlers/ScrapeStatsHandler.js';
import { ScrapeCompetitorHandler } from './handlers/ScrapeCompetitorHandler.js';
import { ScrapeCommentsHandler } from './handlers/ScrapeCommentsHandler.js';
import { ScrapeTrendsHandler } from './handlers/ScrapeTrendsHandler.js';
import { AnalyzeNoteHandler } from './handlers/AnalyzeNoteHandler.js';
import { GenerateContentHandler } from './handlers/GenerateContentHandler.js';
import { GenerateMediaHandler } from './handlers/GenerateMediaHandler.js';
import { HealthCheckHandler } from './handlers/HealthCheckHandler.js';
import { VideoStitchHandler } from './handlers/VideoStitchHandler.js';

export class TaskRegistry {
    private static handlers: Map<string, TaskHandler> = new Map();

    static {
        this.register('PUBLISH', new PublishHandler());
        this.register('SCRAPE_STATS', new ScrapeStatsHandler());
        this.register('SCRAPE_COMPETITOR', new ScrapeCompetitorHandler());
        this.register('SCRAPE_COMMENTS', new ScrapeCommentsHandler());
        this.register('SCRAPE_TRENDS', new ScrapeTrendsHandler());
        this.register('ANALYZE_NOTE', new AnalyzeNoteHandler());
        this.register('GENERATE_CONTENT', new GenerateContentHandler());
        this.register('GENERATE_IMAGE', new GenerateMediaHandler());
        this.register('GENERATE_VIDEO', new GenerateMediaHandler());
        this.register('VIDEO_STITCH', new VideoStitchHandler());
        this.register('CHECK_HEALTH', new HealthCheckHandler());
    }

    private static register(type: string, handler: TaskHandler) {
        this.handlers.set(type, handler);
    }

    public static getHandler(type: string): TaskHandler {
        const handler = this.handlers.get(type);
        if (!handler) {
            throw new Error(`No handler registered for task type: ${type}`);
        }
        return handler;
    }
}
