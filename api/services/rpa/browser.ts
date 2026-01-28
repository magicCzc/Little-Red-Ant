
import { BrowserService } from './BrowserService.js';
import { launchBrowser, createBrowserContext } from './utils.js';
import { getCookies } from './auth.js';

export async function openNoteInBrowser(noteId: string) {
    const session = await BrowserService.getInstance().getAuthenticatedPage('MAIN_SITE', false);
    const { browser, page } = session;
    
    // Disable auto-close for user viewing
    // Or keep it long
    
    await page.goto(`https://www.xiaohongshu.com/explore/${noteId}`, { waitUntil: 'domcontentloaded' });
    
    // Auto close after 10 mins
    setTimeout(() => { try { browser.close(); } catch(e) {} }, 600000);
    return { success: true };
}
