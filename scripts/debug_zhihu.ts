
import { chromium } from 'playwright';

(async () => {
    let browser;
    try {
        console.log('Debugging Zhihu Crawler...');
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
             userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();
        
        console.log('Navigating to https://www.zhihu.com/billboard ...');
        await page.goto('https://www.zhihu.com/billboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log(`Current URL: ${page.url()}`);
        console.log(`Page Title: ${await page.title()}`);
        
        // Wait a bit
        await page.waitForTimeout(5000);
        
        // Check for specific elements
        const hasHotList = await page.$('.HotList-item');
        console.log(`Found .HotList-item? ${!!hasHotList}`);
        
        const hasLogin = await page.$('.SignContainer-content');
        console.log(`Found Login Modal? ${!!hasLogin}`);

        const hasCaptcha = await page.textContent('body');
        if (hasCaptcha?.includes('安全验证') || hasCaptcha?.includes('验证码')) {
            console.log('DETECTED CAPTCHA/SECURITY CHECK!');
        }

        // Dump some HTML
        const content = await page.content();
        console.log('HTML Preview (first 500 chars):', content.substring(0, 500));
        
    } catch (e) {
        console.error('Debug Error:', e);
    } finally {
        if (browser) await browser.close();
    }
})();
