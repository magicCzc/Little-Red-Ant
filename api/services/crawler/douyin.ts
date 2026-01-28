
import { chromium } from 'playwright';
import { TrendItem } from './weibo.js';

export async function fetchDouyinHotSearch(): Promise<TrendItem[]> {
  let browser = null;
  try {
    console.log('Starting Douyin Hot Search crawler...');
    browser = await chromium.launch({
      headless: true, // Try headless false if still failing, but usually stealth args help
      args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled' // Mask automation
      ]
    });
    
    // Use Mobile User Agent to get simpler page structure and potentially bypass desktop captchas
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      locale: 'zh-CN'
    });
    
    // Inject stealth script
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
    });

    const page = await context.newPage();
    
    // Douyin Billboard (Mobile Web Version usually redirects to app, but /hot might work or search page)
    // Desktop URL: https://www.douyin.com/hot
    // Mobile Web often forces login. 
    // Let's stick to Desktop URL but with Desktop UA if Mobile fails.
    // Actually, Douyin PC web is React based and heavy.
    // Let's try Desktop UA with stealth first, as Mobile Web is very aggressive on "Open in App".
    
    // REVERT TO DESKTOP UA for Douyin Web, as it's more accessible than Mobile Web (which is App-walled)
    await context.close();
    const desktopContext = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'zh-CN'
    });
    await desktopContext.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const desktopPage = await desktopContext.newPage();

    await desktopPage.goto('https://www.douyin.com/hot', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for content - Douyin hot list usually has specific class
    try {
        await desktopPage.waitForSelector('[class*="hot-list"], [class*="billboard-item"]', { timeout: 10000 });
    } catch (e) {
        console.log('Timeout waiting for selector, checking page content...');
    }

    // Scrape logic optimized for Douyin's dynamic classes
    const items = await desktopPage.evaluate(() => {
        const list: any[] = [];
        
        // Strategy 1: Look for items with rank and heat
        // Common pattern: A container with children that have indices 1, 2, 3...
        // and heat values (e.g. "1000万")
        
        // Get all text nodes and try to reconstruct
        const bodyText = document.body.innerText;
        const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);
        
        let currentRank = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check if line is a rank (1, 2, 3...)
            // Douyin ranks are usually at start of line or standalone
            if (/^\d+$/.test(line)) {
                const rank = parseInt(line);
                if (rank === currentRank + 1 || rank === currentRank + 2) { // Allow skipping 1 (pinned)
                    // Potential start of item
                    // Next line might be title
                    const title = lines[i+1];
                    const heatLine = lines[i+2];
                    
                    if (title && heatLine && (heatLine.includes('万') || /^\d+$/.test(heatLine))) {
                        let heat = 0;
                        if (heatLine.includes('万')) {
                            heat = parseFloat(heatLine.replace(/[^0-9.]/g, '')) * 10000;
                        } else {
                            heat = parseInt(heatLine);
                        }
                        
                        // Heuristic: Heat should be substantial for a hot list
                        if (heat > 10000) { 
                            list.push({
                                title: title,
                                heat: heat,
                                url: `https://www.douyin.com/search/${encodeURIComponent(title)}`
                            });
                            currentRank = rank;
                            i += 2; // Skip processed lines
                        }
                    }
                }
            }
        }
        
        // Strategy 2: DOM traversal if Strategy 1 fails
        if (list.length < 5) {
             const items = document.querySelectorAll('li, div[class*="item"]');
             items.forEach(el => {
                 const text = (el as HTMLElement).innerText;
                 if (text.includes('万') && text.length < 100) {
                     // Try to split
                     const parts = text.split(/[\n\s]+/);
                     // Usually: Rank Title Heat
                     if (parts.length >= 3) {
                         const heatStr = parts.find(p => p.includes('万'));
                         if (heatStr) {
                             const heat = parseFloat(heatStr.replace('万', '')) * 10000;
                             // Find title (longest part usually)
                             const title = parts.sort((a,b) => b.length - a.length)[0];
                             if (title && heat > 0 && !list.find(x => x.title === title)) {
                                 list.push({ title, heat, url: `https://www.douyin.com/search/${encodeURIComponent(title)}` });
                             }
                         }
                     }
                 }
             });
        }

        return list.slice(0, 20);
    });
    
    // Sort
    const validTrends = items
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 20);
      
    console.log(`Successfully scraped ${validTrends.length} trends from Douyin.`);
    return validTrends;
    
  } catch (error) {
    console.error('Failed to fetch Douyin trends:', error);
    return []; // Return empty to trigger Mock fallback if needed
  } finally {
    if (browser) await browser.close();
  }
}
