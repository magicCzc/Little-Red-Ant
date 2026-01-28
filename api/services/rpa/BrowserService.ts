
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
const EXTENSION_PATH = path.join(process.cwd(), 'extensions');

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
        // If Anonymous, use a temp dir? Or just a specific 'guest' dir.
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
        // If profile is already active, return the existing context/page
        if (this.activeProfiles.has(profileName)) {
            Logger.info('BrowserService', `Reusing active context for ${profileName}`);
            const context = this.activeProfiles.get(profileName)!;
            
            // Ensure context is still open
            try {
                // Check if context has pages, if not create one
                const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
                return { browser: context, context, page };
            } catch (e) {
                // Context might be closed, remove from map and proceed to launch new
                this.activeProfiles.delete(profileName);
            }
        }

        // Wait for lock if another process is launching this profile
        // Simple mutex
        while (this.profileLocks.has(profileName)) {
            Logger.info('BrowserService', `Waiting for profile lock: ${profileName}...`);
            await new Promise(r => setTimeout(r, 1000));
            // Double check if active after wait
             if (this.activeProfiles.has(profileName)) {
                const context = this.activeProfiles.get(profileName)!;
                const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
                return { browser: context, context, page };
            }
        }
        
        // Set lock
        let releaseLock: () => void;
        const lockPromise = new Promise<void>((resolve) => { releaseLock = resolve; });
        this.profileLocks.set(profileName, lockPromise);

        try {
            if (!fs.existsSync(userDataDir)) {
                fs.mkdirSync(userDataDir, { recursive: true });
            }

            Logger.info('BrowserService', `Launching Persistent Context for ${profileName} in ${userDataDir}`);

            // Launch Persistent Context
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
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars',
                    '--window-size=1280,800',
                ]
            });

            // Register active profile
            this.activeProfiles.set(profileName, context);
            
            // Clean up on close
            context.on('close', () => {
                this.activeProfiles.delete(profileName);
                Logger.info('BrowserService', `Profile ${profileName} closed/disconnected.`);
            });

            // Inject Stealth Scripts
            await this.injectStealthScripts(context);

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

            const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
            
            // Apply Page-level Stealth
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'zh-CN,zh;q=0.9',
            });
            
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });

            return { browser: context, context, page };
            
        } finally {
            // Release lock
            this.profileLocks.delete(profileName);
            if (releaseLock!) releaseLock();
        }
    }
    
    // Legacy support for closeAll - might need adjustment for persistent contexts
    // ...

    private async launchBrowser(headless: boolean = true): Promise<Browser> {
        // Force Headed Mode for better pass rate if environment allows
        // Check if we are in "Deep Analysis" mode (heuristic)
        // Or we can just default to Headed for debugging
        
        // Strategy: Use Headed mode for all authentications to reduce detection risk
        // Headless is faster but more detectable.
        // Let's use the parameter but default to false (Headed) if not specified in production?
        // No, keep existing behavior but allow override.
        
        // Ensure user data dir exists
        if (!fs.existsSync(USER_DATA_DIR)) {
            fs.mkdirSync(USER_DATA_DIR, { recursive: true });
        }

        const browser = await chromium.launch({
            headless,
            channel: 'chrome', // Try to use installed Chrome if available for better realism
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled', // Critical for stealth
                '--disable-infobars',
                '--window-size=1280,800',
                // '--start-maximized' // Optional
            ]
        });

        return browser;
    }

    private async createPage(browser: Browser, contextId: string, cookies: any[] = []): Promise<Page> {
        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', // Update to newer Chrome
            locale: 'zh-CN',
            timezoneId: 'Asia/Shanghai',
            permissions: ['geolocation'],
            geolocation: { longitude: 121.4737, latitude: 31.2304 }, // Shanghai
            deviceScaleFactor: 1,
            hasTouch: false,
            isMobile: false,
            javaScriptEnabled: true,
        });
        
        // Add Stealth Scripts (Canvas Noise, etc.)
        await this.injectStealthScripts(context);

        if (cookies && cookies.length > 0) {
            await context.addCookies(cookies);
        }
        
        const page = await context.newPage();
        
        // Anti-detection: Hide webdriver property
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });

        this.activeContexts.set(contextId, { browser, context, page, lastUsed: Date.now() });
        return page;
    }

    private async injectStealthScripts(context: BrowserContext) {
        await context.addInitScript(() => {
            // 1. Canvas Fingerprint Noise
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function(type) {
                const context = this.getContext('2d');
                if (context) {
                    // Shift a pixel slightly to alter the hash
                    const imageData = context.getImageData(0, 0, this.width, this.height);
                    // Minimal noise: change one pixel's alpha channel by 1
                    if (imageData.data.length > 3) {
                         imageData.data[3] = imageData.data[3] === 255 ? 254 : 255; 
                         context.putImageData(imageData, 0, 0);
                    }
                }
                return originalToDataURL.apply(this, arguments as any);
            };

            // 2. WebGL Fingerprint Noise
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                // UNMASKED_VENDOR_WEBGL
                if (parameter === 37445) {
                    return 'Intel Inc.';
                }
                // UNMASKED_RENDERER_WEBGL
                if (parameter === 37446) {
                    return 'Intel Iris OpenGL Engine';
                }
                return getParameter.apply(this, [parameter]);
            };
            
            // 3. Chrome Runtime Mock
            if (!(window as any).chrome) {
                // @ts-ignore
                (window as any).chrome = {
                    runtime: {}
                };
            }
        });
    }
}
