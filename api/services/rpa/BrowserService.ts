import { chromium } from 'playwright-extra';
import { Browser, BrowserContext, Page } from 'playwright';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import { Logger } from '../LoggerService.js';
import { getCookies } from './auth.js';
import db from '../../db.js';

// Apply stealth plugin
chromium.use(stealthPlugin());

const USER_DATA_DIR = path.join(process.cwd(), 'browser_data');

export class BrowserService {
    private static instance: BrowserService;
    private activeContexts: Map<string, { browser: Browser, context: BrowserContext, page: Page, lastUsed: number }>;
    // Lock to prevent multiple instances of same profile
    private profileLocks: Map<string, Promise<any>> = new Map();
    private activeProfiles: Map<string, BrowserContext> = new Map();
    
    private constructor() {
        this.activeContexts = new Map();
    }

    public static getInstance(): BrowserService {
        if (!BrowserService.instance) {
            BrowserService.instance = new BrowserService();
        }
        return BrowserService.instance;
    }

    /**
     * Close all active browser instances
     * Critical for preventing zombie processes and memory leaks
     */
    public async closeAll() {
        Logger.info('BrowserService', `Closing ${this.activeContexts.size} active browser contexts...`);
        
        // Close persistent contexts
        for (const [id, context] of this.activeProfiles.entries()) {
            try {
                await context.close();
                Logger.info('BrowserService', `Closed persistent profile ${id}`);
            } catch (e) {
                Logger.error('BrowserService', `Failed to close profile ${id}`, e);
            }
        }
        this.activeProfiles.clear();

        // Close ad-hoc contexts
        for (const [id, session] of this.activeContexts.entries()) {
            try {
                await session.context.close();
                await session.browser.close();
                Logger.info('BrowserService', `Closed session ${id}`);
            } catch (e) {
                Logger.error('BrowserService', `Failed to close session ${id}`, e);
            }
        }
        this.activeContexts.clear();
    }

    /**
     * Get an authenticated page for a specific purpose
     * @param type 'CREATOR' for Creator Center, 'MAIN_SITE' for Xiaohongshu.com
     * @param headless Whether to run headless
     * @param accountId Optional specific account ID (defaults to active account)
     */
    public async getAuthenticatedPage(type: 'CREATOR' | 'MAIN_SITE' | 'ANONYMOUS', headless: boolean = true, accountId?: number): Promise<{ browser: BrowserContext, context: BrowserContext, page: Page }> {
        // Prepare User Data Dir based on Account ID to isolate profiles
        let targetAccountId = typeof accountId === 'number' ? accountId : undefined;
        
        if (!targetAccountId && type !== 'ANONYMOUS') {
             // Find an active account to use
             const activeAccount = db.prepare('SELECT id FROM accounts WHERE is_active = 1 LIMIT 1').get() as { id: number };
             if (activeAccount) {
                 targetAccountId = activeAccount.id;
             }
        }
        
        const profileName = type === 'ANONYMOUS' ? 'anonymous_profile' : `account_${targetAccountId || 'default'}`;
        const userDataDir = path.join(USER_DATA_DIR, profileName);
        
        // Concurrency Lock: Ensure only one browser instance per profile
        if (this.activeProfiles.has(profileName)) {
            Logger.info('BrowserService', `Reusing active context for ${profileName}`);
            const context = this.activeProfiles.get(profileName)!;
            
            try {
                // Always create a new page for task isolation, do NOT reuse pages()[0]
                const page = await context.newPage();
                return { browser: context, context, page };
            } catch (e) {
                this.activeProfiles.delete(profileName);
            }
        }

        while (this.profileLocks.has(profileName)) {
            Logger.info('BrowserService', `Waiting for profile lock: ${profileName}...`);
            await new Promise(r => setTimeout(r, 1000));
             if (this.activeProfiles.has(profileName)) {
                const context = this.activeProfiles.get(profileName)!;
                // Always create a new page for task isolation
                const page = await context.newPage();
                return { browser: context, context, page };
            }
        }
        
        let releaseLock: () => void;
        const lockPromise = new Promise<void>((resolve) => { releaseLock = resolve; });
        this.profileLocks.set(profileName, lockPromise);

        try {
            if (!fs.existsSync(userDataDir)) {
                fs.mkdirSync(userDataDir, { recursive: true });
            }

            Logger.info('BrowserService', `Launching Persistent Context for ${profileName} in ${userDataDir}`);

            // Launch Persistent Context with Stealth Plugin (via playwright-extra)
            // Note: playwright-extra + stealthPlugin automatically handles navigator.webdriver
            const context = await chromium.launchPersistentContext(userDataDir, {
                headless,
                channel: 'chrome',
                viewport: { width: 1280, height: 800 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                locale: 'zh-CN',
                timezoneId: 'Asia/Shanghai',
                permissions: ['geolocation', 'clipboard-read', 'clipboard-write'],
                geolocation: { longitude: 121.4737, latitude: 31.2304 },
                deviceScaleFactor: 1,
                hasTouch: false,
                isMobile: false,
                javaScriptEnabled: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled', // Critical for stealth
                    '--disable-infobars',
                    '--window-size=1280,800',
                    '--restore-last-session=false', // Disable restore session popup
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--hide-crash-restore-bubble' // Hide the "Chrome did not shut down correctly" bubble
                ]
            });

            this.activeProfiles.set(profileName, context);
            
            context.on('close', () => {
                this.activeProfiles.delete(profileName);
                Logger.info('BrowserService', `Profile ${profileName} closed/disconnected.`);
            });

            // Cookies Management
            if (type !== 'ANONYMOUS') {
                const storageState = getCookies(type, targetAccountId);
                if (storageState) {
                    if (Array.isArray(storageState)) {
                        await context.addCookies(storageState);
                    } else if (storageState && typeof storageState === 'object' && (storageState as any).cookies) {
                        await context.addCookies((storageState as any).cookies);
                    }
                    Logger.info('BrowserService', 'Refreshed cookies from DB into Persistent Context');
                }
            }

            // Always create a new page, don't use the default empty one
            const page = await context.newPage();
            
            // Basic Headers
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'zh-CN,zh;q=0.9',
            });
            
            // REMOVED: Manual stealth injection (injectStealthScripts)
            // Rely on puppeteer-extra-plugin-stealth to handle:
            // - navigator.webdriver
            // - chrome.runtime
            // - WebGL vendor/renderer
            // - Plugins mock

            return { browser: context, context, page };
            
        } finally {
            this.profileLocks.delete(profileName);
            if (releaseLock!) releaseLock();
        }
    }
}
