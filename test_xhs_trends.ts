
import { chromium } from 'playwright';

(async () => {
    let browser;
    try {
        console.log('Exploring Xiaohongshu Trends...');
        browser = await chromium.launch({ headless: true }); // Headless mode
        const context = await browser.newContext({
             userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();
        
        // 1. Try Search Page (often has hot search list)
        await page.goto('https://www.xiaohongshu.com/explore', { waitUntil: 'networkidle' });
        
        console.log('Page loaded. Checking for hot search elements...');
        
        // Try to click search input to trigger dropdown
        const searchInput = await page.$('input[type="search"], input.search-input');
        if (searchInput) {
            console.log('Found search input, clicking...');
            await searchInput.click();
            await page.waitForTimeout(2000); // Wait for dropdown
            
            // Look for hot search items in dropdown
            const items = await page.evaluate(() => {
                const results: any[] = [];
                // Selectors are guess work, need to inspect actual DOM if this fails
                const elements = document.querySelectorAll('.hot-search-item, .search-suggestion-item, .hot-list .item');
                
                elements.forEach(el => {
                    results.push(el.textContent?.trim());
                });
                
                // Backup: Look for any list in a popover
                if (results.length === 0) {
                     const popovers = document.querySelectorAll('[class*="popover"], [class*="dropdown"]');
                     popovers.forEach(p => {
                         results.push(`Popover content: ${p.textContent?.substring(0, 50)}`);
                     });
                }
                
                return results;
            });
            
            console.log('Dropdown items:', items);
        } else {
            console.log('Search input not found.');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        if (browser) await browser.close();
    }
})();
