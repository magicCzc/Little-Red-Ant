import { Page, ElementHandle, Locator, BrowserContext } from 'playwright';
import { Logger } from '../../LoggerService.js';
import { createCursor, GhostCursor } from 'ghost-cursor';

export class RateLimiter {
    private tokens: number;
    private lastRefill: number;
    private maxTokens: number;
    private refillRate: number; // tokens per second

    constructor(maxTokens: number, refillRate: number) {
        this.maxTokens = maxTokens;
        this.refillRate = refillRate;
        this.tokens = maxTokens;
        this.lastRefill = Date.now();
    }

    async wait(): Promise<void> {
        this.refill();
        if (this.tokens < 1) {
            const timeToNextToken = (1 - this.tokens) / this.refillRate * 1000;
            Logger.info('RateLimiter', `Rate limit hit, waiting ${Math.ceil(timeToNextToken)}ms`);
            await new Promise(r => setTimeout(r, timeToNextToken));
            this.refill();
        }
        this.tokens -= 1;
    }

    private refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        const newTokens = elapsed * this.refillRate;
        if (newTokens > 0) {
            this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
            this.lastRefill = now;
        }
    }
}

export class RPAUtils {
    private static limiters: Map<string, RateLimiter> = new Map();

    /**
     * Enforce rate limiting for a specific key (e.g., 'xiaohongshu')
     * @param key The identifier for the limit bucket
     * @param maxRequests Maximum requests allowed in the window
     * @param windowSeconds Window size in seconds (default 60)
     */
    static async checkRateLimit(key: string, maxRequests: number = 30, windowSeconds: number = 60) {
        if (!this.limiters.has(key)) {
            // Refill rate = maxRequests / windowSeconds
            const refillRate = maxRequests / windowSeconds;
            this.limiters.set(key, new RateLimiter(maxRequests, refillRate));
        }
        await this.limiters.get(key)!.wait();
    }
    
    /**
     * Initialize Page with standard polyfills and settings

     * Prevents common errors like "ReferenceError: __name is not defined"
     */
    static async initPage(page: Page) {
        // Inject global polyfill for __name
        // This fixes the esbuild/TS issue where compiled code uses __name helper
        // but browser environment doesn't have it.
        await page.addInitScript(() => {
            if (typeof (window as any).__name === 'undefined') {
                (window as any).__name = (f: any) => f;
            }
        });
        
        // Also inject it immediately for current context
        await page.evaluate(() => {
            if (typeof (window as any).__name === 'undefined') {
                (window as any).__name = (f: any) => f;
            }
        });

        // Initialize Ghost Cursor if needed
        // Note: GhostCursor for Playwright is a bit different, it often wraps the page.
        // But the library 'ghost-cursor' supports Puppeteer/Playwright.
        // We will instantiate it on demand in actions.
    }

    /**
     * Get Ghost Cursor instance for the page
     */
    private static async getCursor(page: Page): Promise<GhostCursor> {
        // Ideally we should cache this on the page object or a weakmap
        // For now, create new for each action (stateless) or use a simple cache key
        if ((page as any)._cursor) return (page as any)._cursor;
        
        const cursor = createCursor(page);
        (page as any)._cursor = cursor;
        return cursor;
    }

    /**
     * Human-like delay with randomization
     */
    static async humanDelay(page: Page, min = 500, max = 1500) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await page.waitForTimeout(delay);
    }

    /**
     * Safe Click with Ghost Cursor (Human-like movement)
     */
    static async safeClick(page: Page, selector: string, timeout = 5000): Promise<boolean> {
        try {
            const locator = page.locator(selector).first();
            await locator.waitFor({ state: 'visible', timeout });
            
            // Ghost Cursor Move & Click
            const cursor = await this.getCursor(page);
            
            // Need to get element handle for ghost-cursor
            // locator.elementHandle() is deprecated but ghost-cursor might need it or coordinate
            // Actually ghost-cursor 'click' method takes a selector or element handle.
            
            // Use standard Playwright click if ghost cursor fails, but try ghost first
            try {
                // If selector is simple string
                await cursor.click(selector);
            } catch (cursorError) {
                // Fallback to manual move + click
                 const box = await locator.boundingBox();
                if (box) {
                    await cursor.moveTo({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
                    await page.mouse.down();
                    await page.waitForTimeout(Math.random() * 50 + 50);
                    await page.mouse.up();
                } else {
                    await locator.click();
                }
            }

            return true;
        } catch (e) {
            Logger.warn('RPA:Utils', `Failed to click ${selector}: ${(e as Error).message}`);
            return false;
        }
    }

    /**
     * Safe Input Text (Type like a human)
     * Now supports Frame Awareness and dynamic fallback
     */
    static async safeType(page: Page, selector: string, text: string, timeout = 5000) {
        try {
            // Frame Awareness: Check all frames if not found in main page
            let locator = page.locator(selector).first();
            let isVisible = await locator.isVisible().catch(() => false);

            if (!isVisible) {
                // Try searching in frames
                for (const frame of page.frames()) {
                    const frameLocator = frame.locator(selector).first();
                    if (await frameLocator.isVisible().catch(() => false)) {
                        Logger.info('RPA:Utils', `Found element in frame: ${frame.url()}`);
                        locator = frameLocator;
                        isVisible = true;
                        break;
                    }
                }
            }

            // If still not visible, wait for it (which will likely throw)
            if (!isVisible) {
                await locator.waitFor({ state: 'visible', timeout });
            }
            
            // Click to focus first
            // Note: Reuse safeClick logic but adapted for locator instance?
            // For now, just click the locator we found
            await locator.click({ force: true });
            
            // Randomize typing speed
            // Human typing speed varies. Average 50-150ms per key.
            await page.keyboard.type(text, { delay: Math.random() * 50 + 50 }); 
        } catch (e: any) {
             // Debugging: Dump HTML if timeout
             if (e.message.includes('Timeout') || e.message.includes('visible')) {
                 Logger.warn('RPA:Utils', `Failed to find/wait for input ${selector}: ${e.message}`);
                 
                 // Dump Frames info
                 const framesInfo = page.frames().map(f => ({ url: f.url(), name: f.name() }));
                 Logger.info('RPA:Utils', `Available Frames: ${JSON.stringify(framesInfo)}`);

                 throw e; 
             }

            Logger.warn('RPA:Utils', `Typing failed, trying clipboard fallback: ${e.message}`);
            // Fallback to clipboard paste
            try {
                await page.evaluate((t) => {
                     // @ts-ignore
                     return navigator.clipboard.writeText(t);
                }, text);
                const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
                await page.keyboard.press(`${modifier}+V`);
            } catch (fallbackError) {
                Logger.error('RPA:Utils', 'Clipboard fallback also failed', fallbackError);
                throw e; 
            }
        }
    }

    /**
     * Upload File Helper
     */
    static async uploadFile(page: Page, selector: string, filePaths: string[]) {
        const fileInput = page.locator(selector).first();
        await fileInput.setInputFiles(filePaths);
    }

    /**
     * Human-like scroll
     */
    static async autoScroll(page: Page) {
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
    }
}
