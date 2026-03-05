
import { Page } from 'playwright';
import { ScrapingStrategy, ScrapeResult } from './ScrapingStrategy.js';
import { Logger } from '../../LoggerService.js';
import { DataSanitizer } from '../../../utils/DataSanitizer.js';

export class DomScrapeStrategy implements ScrapingStrategy {
    async execute(page: Page, userId: string): Promise<ScrapeResult | null> {
        Logger.info('RPA:Strategy:DOM', 'Executing DOM scraping strategy...');
        
        // Note: Page is already navigated and loaded by CompetitorScraper
        // Just scroll to load more content
        try {
            for (let i = 0; i < 3; i++) {
                await page.evaluate("window.scrollBy(0, 800)");
                await page.waitForTimeout(1500);
            }
        } catch(e) {}

        // Use STRING evaluation to avoid TS/esbuild injection of helpers like __name
        // Updated selectors for current XHS profile page structure
        const info = await page.evaluate<any>(`
            (function() {
                // Updated selectors for user info - more comprehensive
                const nameSelectors = [
                    '.user-name', '.user-nickname', '.name', '.nickname',
                    '[class*="user-name"]', '[class*="nickname"]',
                    'h1[class*="name"]', '.profile-header h1',
                    '.user-info-panel .name', '.user-basic-info .name'
                ];
                let nameEl = null;
                for (const sel of nameSelectors) {
                    nameEl = document.querySelector(sel);
                    if (nameEl && nameEl.innerText.trim()) break;
                }
                
                const avatarSelectors = [
                    '.user-avatar img', '.avatar img', '.header-avatar img',
                    '[class*="avatar"] img', '.profile-header img',
                    '.user-info-panel img', 'img[class*="avatar"]'
                ];
                let avatarEl = null;
                for (const sel of avatarSelectors) {
                    avatarEl = document.querySelector(sel);
                    if (avatarEl && avatarEl.src) break;
                }
                
                const descSelectors = [
                    '.user-desc', '.desc', '.user-intro', '.intro',
                    '[class*="desc"]', '[class*="intro"]', 
                    '.user-info-panel .desc', '.profile-header .desc'
                ];
                let descEl = null;
                for (const sel of descSelectors) {
                    descEl = document.querySelector(sel);
                    if (descEl && descEl.innerText.trim()) break;
                }
                
                // Stats selectors
                const statsSelectors = [
                    '.user-interactions div', '.data-info div',
                    '.user-stats div', '.stats div',
                    '[class*="interaction"] div', '[class*="stat"] div'
                ];
                let dataStats = [];
                for (const sel of statsSelectors) {
                    const els = document.querySelectorAll(sel);
                    if (els.length > 0) {
                        dataStats = Array.from(els).map(function(el) { return el.innerText; });
                        break;
                    }
                }
                
                // Note items - updated selectors
                const noteSelectors = [
                    '.note-item', '.feed-item', 'section[class*="note-item"]',
                    '[class*="note-card"]', '[class*="feed-card"]',
                    '.user-note-item', '.explore-item'
                ];
                let noteEls = [];
                for (const sel of noteSelectors) {
                    noteEls = document.querySelectorAll(sel);
                    if (noteEls.length > 0) break;
                }
                
                const notes = [];
                
                noteEls.forEach(function(el, idx) {
                    if (idx >= 20) return;
                    
                    // Title selectors
                    const titleSelectors = ['.title', '.note-title', '.footer .title', '[class*="title"]'];
                    let titleEl = null;
                    for (const sel of titleSelectors) {
                        titleEl = el.querySelector(sel);
                        if (titleEl && titleEl.innerText.trim()) break;
                    }
                    
                    // Like count selectors
                    const likeSelectors = ['.like-count', '.likes', '.count', '.footer .like-wrapper', '[class*="like"]'];
                    let likeEl = null;
                    for (const sel of likeSelectors) {
                        likeEl = el.querySelector(sel);
                        if (likeEl) break;
                    }
                    
                    // Improved Cover Extraction
                    let coverUrl = '';
                    // 1. Try to find the image container specifically
                    const coverSelectors = ['.cover', '.note-cover', '[class*="cover"]', '[class*="image"]'];
                    for (const sel of coverSelectors) {
                        const coverDiv = el.querySelector(sel);
                        if (coverDiv) {
                            const style = coverDiv.style.backgroundImage;
                            if (style && style.includes('url')) {
                                const match = style.match(/url\\(['"]?(.*?)['"]?\\)/);
                                if (match) {
                                    coverUrl = match[1];
                                    break;
                                }
                            }
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
                    nickname: nameEl ? nameEl.innerText.trim() : '',
                    avatar: avatarEl ? avatarEl.src : '',
                    desc: descEl ? descEl.innerText.trim() : '',
                    stats: dataStats.join(' | '),
                    notes: notes,
                    debug: {
                        nameFound: !!nameEl,
                        avatarFound: !!avatarEl,
                        notesFound: noteEls.length
                    }
                };
            })()
        `);
        
        Logger.info('RPA:Strategy:DOM', `Debug info: nameFound=${info.debug?.nameFound}, avatarFound=${info.debug?.avatarFound}, notesFound=${info.debug?.notesFound}`);

        // Normalize DOM Data
        const normalizedNotes = info.notes.map((n: any) => ({
            title: DataSanitizer.sanitizeText(n.title, 100),
            likes: DataSanitizer.parseCount(n.likesRaw),
            cover: DataSanitizer.normalizeUrl(n.cover),
            url: n.url,
            note_id: null 
        }));

        Logger.info('RPA:Strategy:DOM', `Extracted data: nickname='${info.nickname}', notesCount=${normalizedNotes.length}`);

        if (!info.nickname && normalizedNotes.length === 0) {
            Logger.warn('RPA:Strategy:DOM', `DOM scraping failed: no valid data extracted`);
            return null;
        }

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
