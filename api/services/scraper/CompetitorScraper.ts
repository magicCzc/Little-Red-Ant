
import { BrowserService } from '../rpa/BrowserService.js';
import { Logger } from '../LoggerService.js';
import { ApiInterceptStrategy } from './strategies/ApiInterceptStrategy.js';
import { DomScrapeStrategy } from './strategies/DomScrapeStrategy.js';
import { ScrapeResult } from './strategies/ScrapingStrategy.js';
import fs from 'fs';
import path from 'path';

export class CompetitorScraper {
    private strategies = [
        new ApiInterceptStrategy(),
        new DomScrapeStrategy()
    ];

    async scrape(userId: string): Promise<ScrapeResult> {
        // 尝试使用已登录账号访问
        let session = await this.tryAuthenticatedAccess(userId);
        
        // 如果登录访问被重定向到登录页，则使用匿名模式
        if (!session) {
            Logger.info('RPA:Competitor', 'Using anonymous mode to access public profile...');
            session = await BrowserService.getInstance().getAuthenticatedPage('ANONYMOUS', true);
        }

        const { browser, page } = session;

        try {
            const targetUrl = `https://www.xiaohongshu.com/user/profile/${userId}`;
            Logger.info('RPA:Competitor', `Starting scrape for user: ${userId}`);
            
            // Navigate to target page
            await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
            Logger.info('RPA:Competitor', `Page loaded: ${targetUrl}`);
            
            // Check page state
            const pageTitle = await page.title();
            const pageUrl = page.url();
            Logger.info('RPA:Competitor', `Page title: ${pageTitle}, URL: ${pageUrl}`);
            
            // Debug: Check if page has content
            const bodyContent = await page.evaluate(() => document.body.innerText.substring(0, 500));
            Logger.info('RPA:Competitor', `Page content preview: ${bodyContent}`);
            
            // Execute scraping strategies
            for (const strategy of this.strategies) {
                try {
                    const result = await strategy.execute(page, userId);
                    if (result) {
                        Logger.info('RPA:Competitor', `Successfully scraped using ${strategy.constructor.name}`);
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
    
    /**
     * 尝试使用已登录账号访问，如果被重定向到登录页则返回 null
     */
    private async tryAuthenticatedAccess(userId: string): Promise<any | null> {
        let session;
        try {
            session = await BrowserService.getInstance().getAuthenticatedPage('MAIN_SITE', true);
        } catch (e) {
            Logger.warn('RPA:Competitor', 'Main Site cookie missing/invalid, trying Creator cookie as fallback...');
            try {
                session = await BrowserService.getInstance().getAuthenticatedPage('CREATOR', true);
            } catch (e2) {
                return null;
            }
        }

        const { browser, page } = session;
        
        try {
            const targetUrl = `https://www.xiaohongshu.com/user/profile/${userId}`;
            await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
            
            const pageUrl = page.url();
            
            // 检查是否被重定向到登录页面
            if (pageUrl.includes('/login') || pageUrl.includes('redirectPath')) {
                Logger.warn('RPA:Competitor', 'Cookie expired, redirected to login page. Will try anonymous mode.');
                await browser.close();
                return null;
            }
            
            return session;
        } catch (e) {
            await browser.close();
            return null;
        }
    }
}
