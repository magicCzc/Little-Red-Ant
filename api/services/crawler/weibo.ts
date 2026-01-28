import { chromium } from 'playwright';

export interface TrendItem {
  title: string;
  heat: number;
  url: string;
}

export async function fetchWeiboHotSearch(): Promise<TrendItem[]> {
  let browser = null;
  try {
    console.log('Starting Weibo Hot Search crawler...');
    browser = await chromium.launch({
      headless: true, // Headless is fine for this
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    
    // Go to Weibo Hot Search Summary
    // Note: Weibo might redirect to login if heavily accessed.
    await page.goto('https://s.weibo.com/top/summary', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Check if we are blocked or need verification
    // Sometimes Weibo shows a "visitor" page.
    
    // Wait for the list to appear
    await page.waitForSelector('td.td-02', { timeout: 15000 });
    
    // Scrape data
    const trends = await page.evaluate(() => {
      const items: any[] = [];
      const rows = document.querySelectorAll('tbody tr');
      
      rows.forEach((row) => {
        const titleEl = row.querySelector('td.td-02 > a');
        const heatEl = row.querySelector('td.td-02 > span');
        
        if (titleEl) {
          const title = titleEl.textContent?.trim() || '';
          const url = (titleEl as HTMLAnchorElement).href;
          // Extract heat score (remove non-numeric chars)
          const heatText = heatEl?.textContent?.trim() || '0';
          const heat = parseInt(heatText.replace(/[^0-9]/g, '')) || 0;
          
          if (title) {
            items.push({ title, heat, url });
          }
        }
      });
      
      return items;
    });
    
    // Filter out pinned items (usually no heat score or specific keywords)
    // and sort by heat desc
    const validTrends = trends
      .filter(t => t.heat > 0) // Filter out pinned/ad items that often have 0 heat
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 20); // Top 20
      
    console.log(`Successfully scraped ${validTrends.length} trends from Weibo.`);
    return validTrends;
    
  } catch (error) {
    console.error('Failed to fetch Weibo trends:', error);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}