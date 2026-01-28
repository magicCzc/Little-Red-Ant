
import { Page } from 'playwright';
import { ScrapingStrategy, ScrapeResult } from './ScrapingStrategy.js';
import { Logger } from '../../LoggerService.js';
import { DataSanitizer } from '../../../utils/DataSanitizer.js';

export class DomScrapeStrategy implements ScrapingStrategy {
    async execute(page: Page, userId: string): Promise<ScrapeResult | null> {
        Logger.info('RPA:Strategy:DOM', 'Falling back to DOM Scraping...');

        // 3.1 Scroll to load more notes (Simulated)
        try {
            await page.evaluate("window.scrollBy(0, 1000)");
            await page.waitForTimeout(1000);
            await page.evaluate("window.scrollBy(0, 1000)");
            await page.waitForTimeout(1000);
        } catch(e) {}

        // Use STRING evaluation to avoid TS/esbuild injection of helpers like __name
        const info = await page.evaluate<any>(`
            (function() {
                const nameEl = document.querySelector('.user-name, .user-nickname, .name');
                const avatarEl = document.querySelector('.user-avatar img, .avatar img');
                const descEl = document.querySelector('.user-desc, .desc');
                const dataStats = Array.from(document.querySelectorAll('.user-interactions div, .data-info div')).map(function(el) { return el.innerText; });
                
                const noteEls = document.querySelectorAll('.note-item, .feed-item, section[class*="note-item"]');
                const notes = [];
                
                noteEls.forEach(function(el, idx) {
                    if (idx >= 20) return;
                    const titleEl = el.querySelector('.title, .note-title, .footer .title');
                    const likeEl = el.querySelector('.like-count, .likes, .count, .footer .like-wrapper');
                    
                    // Improved Cover Extraction
                    let coverUrl = '';
                    // 1. Try to find the image container specifically
                    const coverDiv = el.querySelector('.cover, .note-cover, [class*="cover"]');
                    if (coverDiv) {
                        const style = coverDiv.style.backgroundImage;
                        if (style && style.includes('url')) {
                            // Handle unquoted and quoted urls
                            const match = style.match(/url\\(['"]?(.*?)['"]?\\)/);
                            if (match) coverUrl = match[1];
                        }
                    }
                    
                    // 2. Fallback to any img tag inside the item
                    if (!coverUrl) {
                        const img = el.querySelector('img');
                        if (img) {
                            coverUrl = img.src;
                        }
                    }

                    // 3. Clean up data:image placeholders
                    if (coverUrl && coverUrl.startsWith('data:image')) {
                        coverUrl = '';
                    }

                    if (titleEl) {
                        let likes = '0';
                        if (likeEl) {
                            likes = likeEl.innerText.trim();
                        }
                        
                        const linkEl = el.querySelector('a');
                        let url = linkEl ? linkEl.href : '';
                        if (url && !url.startsWith('http')) {
                            url = 'https://www.xiaohongshu.com' + url;
                        }
                        notes.push({
                            title: titleEl.innerText.trim(),
                            likesRaw: likes,
                            cover: coverUrl,
                            url: url
                        });
                    }
                });

                return {
                    nickname: nameEl ? nameEl.innerText : '',
                    avatar: avatarEl ? avatarEl.src : '',
                    desc: descEl ? descEl.innerText : '',
                    stats: dataStats.join(' | '),
                    notes: notes
                };
            })()
        `);

        // Normalize DOM Data
        const normalizedNotes = info.notes.map((n: any) => ({
            title: DataSanitizer.sanitizeText(n.title, 100),
            likes: DataSanitizer.parseCount(n.likesRaw),
            cover: DataSanitizer.normalizeUrl(n.cover),
            url: n.url,
            note_id: null 
        }));

        if (!info.nickname && normalizedNotes.length === 0) return null;

        return {
            info: {
                nickname: info.nickname,
                avatar: info.avatar,
                desc: info.desc,
                stats: info.stats
            },
            notes: normalizedNotes,
            source: 'DOM'
        };
    }
}
