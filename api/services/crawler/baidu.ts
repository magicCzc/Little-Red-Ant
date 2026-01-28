import axios from 'axios';
import * as cheerio from 'cheerio';

export interface TrendItem {
  title: string;
  heat: number;
  url: string;
}

export async function fetchBaiduHotSearch(): Promise<TrendItem[]> {
  try {
    console.log('Fetching Baidu Hot Search...');
    // Add headers to mimic a real browser
    const response = await axios.get('https://top.baidu.com/board?tab=realtime', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    });
    const html = response.data;
    const $ = cheerio.load(html);
    
    const items: TrendItem[] = [];
    
    // Select rows
    // Baidu structure might have changed or is dynamic.
    // Let's try more generic selectors or check the actual response structure.
    // The previous selector .category-wrap_iQLoo is specific to their React build class names which change.
    // We should look for structure.
    
    // Strategy: Look for the list container
    // Usually inside a main container
    
    // Try to find items by content structure
    // Items usually have a title, heat index, and link
    
    // Fallback: Look for any element that looks like a title in a list
    // Baidu often uses:
    // <div class="c-single-text-ellipsis">Title</div>
    // <div class="hot-index_1Bl1a">Heat</div>
    
    // If specific classes fail, try finding by relative structure
    // But let's first update to the latest known classes if possible, or use more robust selectors.
    
    // Try broad search
    const titles = $('.c-single-text-ellipsis');
    
    if (titles.length > 0) {
        titles.each((i, el) => {
            const title = $(el).text().trim();
            // Parent or grandparent usually contains the row
            const row = $(el).closest('div[class*="category-wrap"]');
            
            // Heat
            const heatEl = row.find('div[class*="hot-index"]');
            const heatText = heatEl.text().trim();
            const heat = parseInt(heatText.replace(/[^0-9]/g, '')) || 0;
            
            // Url
            const urlEl = row.find('a');
            const url = urlEl.attr('href') || '';
            
            if (title && heat > 0) {
                items.push({ title, heat, url });
            }
        });
    }
    
    console.log(`Successfully scraped ${items.length} trends from Baidu.`);
    return items.slice(0, 30);
    
  } catch (error) {
    console.error('Failed to fetch Baidu trends:', error);
    return [];
  }
}