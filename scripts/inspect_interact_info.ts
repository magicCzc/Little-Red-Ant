
import { BrowserService } from '../api/services/rpa/BrowserService.js';

async function inspectInteractInfo() {
    console.log('Inspecting feed for interact_info...');
    const session = await BrowserService.getInstance().getAuthenticatedPage('MAIN_SITE', true);
    const { page } = session;

    page.on('response', async (response) => {
        const url = response.url();
        // Log all API responses to see what we get
        if (url.includes('/api/')) {
             // console.log('Response from:', url);
        }

        if (url.includes('/api/sns/web/v1/homefeed') || url.includes('/api/sns/web/v1/feed')) {
            console.log('Captured feed response:', url);
            try {
                const json = await response.json();
                if (json.data && json.data.items) {
                    console.log('--- Interact Info Debug ---');
                    const item = json.data.items[0];
                    console.log('Keys:', Object.keys(item));
                    if (item.note_card) {
                        console.log('Note Card Keys:', Object.keys(item.note_card));
                        console.log('Note Card Interact Info:', JSON.stringify(item.note_card.interact_info));
                    }
                    console.log('Full Item:', JSON.stringify(item, null, 2));
                    process.exit(0);
                }
            } catch (e) {
                console.error('Error parsing JSON:', e);
            }
        }
    });

    await page.goto('https://www.xiaohongshu.com/explore', { waitUntil: 'domcontentloaded' });
    
    // Scroll down to trigger more loads
    console.log('Scrolling...');
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollBy(0, 1000));
    
    await page.waitForTimeout(5000);
}

inspectInteractInfo();
