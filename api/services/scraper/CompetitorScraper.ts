
import { BrowserService } from '../rpa/BrowserService.js';
import { Logger } from '../LoggerService.js';
import { ApiInterceptStrategy } from './strategies/ApiInterceptStrategy.js';
import { DomScrapeStrategy } from './strategies/DomScrapeStrategy.js';
import { ScrapeResult } from './strategies/ScrapingStrategy.js';

export class CompetitorScraper {
    private strategies = [
        new ApiInterceptStrategy(),
        new DomScrapeStrategy()
    ];

    async scrape(userId: string): Promise<ScrapeResult> {
        let session;
        try {
            session = await BrowserService.getInstance().getAuthenticatedPage('MAIN_SITE', true);
        } catch (e) {
            Logger.warn('RPA:Competitor', 'Main Site cookie missing/invalid, trying Creator cookie as fallback...');
            session = await BrowserService.getInstance().getAuthenticatedPage('CREATOR', true);
        }

        const { browser, page } = session;

        try {
            // Check Anti-bot
            const targetUrl = `https://www.xiaohongshu.com/user/profile/${userId}`;
            // Pre-check page health (optional, strategies do this too but good to fail fast)
            
            for (const strategy of this.strategies) {
                try {
                    const result = await strategy.execute(page, userId);
                    if (result) {
                        return result;
                    }
                } catch (e: any) {
                    Logger.warn('RPA:Competitor', `Strategy ${strategy.constructor.name} failed: ${e.message}`);
                }
            }
            
            throw new Error('All scraping strategies failed');

        } finally {
            if (browser) await browser.close();
        }
    }
}
