
import { Page, ElementHandle, Locator } from 'playwright';
import { Logger } from '../../LoggerService.js';

export class RPAUtils {
    
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
    }

    /**
     * Human-like delay with randomization
     */
    static async humanDelay(page: Page, min = 500, max = 1500) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await page.waitForTimeout(delay);
    }

    /**
     * Safe Click with retry and visibility check
     */
    static async safeClick(page: Page, selector: string, timeout = 5000): Promise<boolean> {
        try {
            const locator = page.locator(selector).first();
            await locator.waitFor({ state: 'visible', timeout });
            
            // Human move
            const box = await locator.boundingBox();
            if (box) {
                await page.mouse.move(
                    box.x + box.width / 2, 
                    box.y + box.height / 2, 
                    { steps: 5 }
                );
            }
            
            await locator.click();
            return true;
        } catch (e) {
            Logger.warn('RPA:Utils', `Failed to click ${selector}: ${(e as Error).message}`);
            return false;
        }
    }

    /**
     * Safe Input Text (Type like a human)
     */
    static async safeType(page: Page, selector: string, text: string) {
        try {
            const locator = page.locator(selector).first();
            await locator.click();
            await page.keyboard.type(text, { delay: 50 }); // 50ms per keystroke
        } catch (e) {
            // Fallback to clipboard paste if typing fails (e.g. anti-bot on input)
            await page.evaluate(function(t) { return navigator.clipboard.writeText(t); }, text);
            await page.keyboard.press('Control+V');
        }
    }

    /**
     * Upload File Helper
     */
    static async uploadFile(page: Page, selector: string, filePaths: string[]) {
        const fileInput = page.locator(selector).first();
        await fileInput.setInputFiles(filePaths);
    }
}
