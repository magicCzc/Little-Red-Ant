
import { Page } from 'playwright';

export interface ScrapeResult {
    info: {
        nickname: string;
        avatar: string;
        desc: string;
        stats: string;
    };
    notes: any[];
    source: 'API' | 'DOM';
}

export interface ScrapingStrategy {
    execute(page: Page, userId: string): Promise<ScrapeResult | null>;
}
