
import { chromium } from 'playwright';
import { TrendItem } from './weibo.js';

export async function fetchZhihuHotSearch(): Promise<TrendItem[]> {
  let browser;
  try {
    console.log('Fetching Zhihu Hot Search via Playwright...');
    browser = await chromium.launch({ 
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        locale: 'zh-CN'
    });
    
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
    });

    const page = await context.newPage();
    
    // Try to access API directly via Page if possible? 
    // Zhihu Billboard API: https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total
    // But it requires signature usually.
    // Let's stick to scraping the page content.
    
    try {
        await page.goto('https://www.zhihu.com/billboard', { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(2000);
        
        // Check for login
        if (page.url().includes('signin')) {
            console.warn('Redirected to login page. Anti-bot triggered.');
            // Try accessing a specific question page to maybe get sidebar hot list? 
            // Or just fail gracefully.
            return [];
        }
    } catch (e: any) {
        console.warn('Navigation timeout or error, trying to continue...', e.message);
    }
    
    // Extract data from DOM
    const items = await page.evaluate(function() {
        const list: any[] = [];
        
        // 1. Try script data (hydration data)
        const script = document.getElementById('js-initialData');
        if (script && script.textContent) {
            try {
                const data = JSON.parse(script.textContent);
                // Locate hot list in state tree
                // Structure varies: initialState.topstory.hotList or similar
                const hotList = data?.initialState?.topstory?.hotList || data?.initialState?.billboard?.rankList;
                
                if (hotList && Array.isArray(hotList)) {
                     hotList.forEach((item: any) => {
                        const target = item.target || item;
                        const title = target.titleArea?.text || target.title;
                        const heatText = target.metricsArea?.text || target.heat_text || target.detail_text || '';
                        const url = target.link?.url || target.url || `https://www.zhihu.com/question/${target.id}`;
                        
                        let heat = 0;
                        if (heatText.includes('万')) {
                            heat = parseFloat(heatText.replace(/[^0-9.]/g, '')) * 10000;
                        } else {
                            heat = parseFloat(heatText.replace(/[^0-9.]/g, '')) || 0;
                        }
                        
                        if (title) list.push({ title, heat, url });
                     });
                     return list;
                }
            } catch (e) {}
        }
        
        // 2. Fallback to DOM scraping
        const elements = document.querySelectorAll('.HotList-item');
        elements.forEach(el => {
            const titleEl = el.querySelector('.HotList-itemTitle');
            const heatEl = el.querySelector('.HotList-itemMetrics');
            const linkEl = el.querySelector('a.HotList-itemBody');
            
            if (titleEl) {
                const title = titleEl.textContent?.trim() || '';
                const heatText = heatEl?.textContent?.trim() || '';
                const url = (linkEl as HTMLAnchorElement)?.href || '';
                
                let heat = 0;
                if (heatText.includes('万')) {
                    heat = parseFloat(heatText.replace(/[^0-9.]/g, '')) * 10000;
                } else {
                    heat = parseFloat(heatText.replace(/[^0-9.]/g, '')) || 0;
                }
                
                if (title) list.push({ title, heat, url });
            }
        });
        return list;
    });
    
    console.log(`Successfully scraped ${items.length} trends from Zhihu.`);
    return items;
    
  } catch (error) {
    console.error('Failed to fetch Zhihu trends:', error);
    return [];
  } finally {
      if (browser) await browser.close();
  }
}
