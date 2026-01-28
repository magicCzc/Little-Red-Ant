import { BrowserService } from './BrowserService.js';
import { Logger } from '../LoggerService.js';
import { Selectors } from './config/selectors.js';
import { RPAUtils } from './utils/RPAUtils.js';

export * from './auth.js';
export * from './publish.js';
export * from './stats.js';
export * from './browser.js';
export * from './trends.js';

/**
 * Scrape full details of a specific note
 */
export async function scrapeNoteDetail(noteId: string, accountId?: number, forceAnonymous: boolean = false) {
    let session;
    let isAnonymous = forceAnonymous;

    // --- Session Management Strategy ---
    try {
        if (forceAnonymous) {
            Logger.info('RPA:NoteDetail', 'Forcing Anonymous Mode (Plan B)...');
            session = await BrowserService.getInstance().getAuthenticatedPage('ANONYMOUS', true);
            isAnonymous = true;
        } else {
            session = await BrowserService.getInstance().getAuthenticatedPage(accountId ? accountId.toString() as any : 'MAIN_SITE', true);
        }
    } catch (e) {
        if (!forceAnonymous) {
            Logger.warn('RPA:NoteDetail', 'Authenticated session failed, fallback to anonymous...');
            try {
                session = await BrowserService.getInstance().getAuthenticatedPage('ANONYMOUS', true);
                isAnonymous = true;
            } catch (anonError) {
                throw new Error('Need active session to scrape note details.');
            }
        } else {
            throw e;
        }
    }
    
    const { page } = session;

    try {
        // --- Navigation ---
        let targetUrl = noteId.startsWith('http') ? noteId : `https://www.xiaohongshu.com/explore/${noteId}`;
        
        Logger.info('RPA:NoteDetail', `Navigating to ${targetUrl} (${isAnonymous ? 'Anonymous' : 'Authenticated'})...`);
        
        await page.setExtraHTTPHeaders({
            'Referer': 'https://www.xiaohongshu.com/explore',
            'Upgrade-Insecure-Requests': '1'
        });

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // --- Wait for Content or Block ---
        try {
            await page.waitForFunction((selectors) => {
                const s = selectors as any;
                return document.querySelector(s.NoteDetail.Title) || 
                       document.querySelector(s.NoteDetail.Media.Video) || 
                       document.querySelector(s.NoteDetail.Content) ||
                       document.querySelector(s.Common.AntiBot.AccessLimit) ||
                       document.title.includes('404');
            }, Selectors, { timeout: 15000 });
        } catch(e) {
            Logger.warn('RPA:NoteDetail', 'Content selector timeout, proceeding to check...');
        }

        await RPAUtils.humanDelay(page, 1000, 2000);

        // --- Security & Status Check ---
        // Use string evaluation to avoid 'ReferenceError: __name is not defined' caused by esbuild/tsx injection
        const status = await page.evaluate(`(selectors) => {
            // Check Blockers
            const accessLimit = document.querySelector(selectors.Common.AntiBot.AccessLimit);
            const verifySlider = document.querySelector(selectors.Common.AntiBot.Captcha);
            
            // Check 404
            const pageText = document.body.innerText;
            const is404 = document.title.includes('404') || pageText.includes('页面不见了') || pageText.includes('无法浏览');
            
            // Check Content
            const hasContent = !!document.querySelector(selectors.NoteDetail.Title) || 
                               !!document.querySelector(selectors.NoteDetail.Media.Video) ||
                               !!document.querySelector(selectors.NoteDetail.Content);
            
            if (hasContent) {
                return { blocked: false, needsVerify: false, is404: false };
            }

            const blocked = !!accessLimit || !!verifySlider;
            const needsVerify = pageText.includes('安全验证') || (pageText.includes('访问太频繁') && !hasContent);
            
            return { blocked, needsVerify, is404 };
        }`, Selectors);

        if (status.blocked || status.needsVerify) {
            Logger.warn('RPA:NoteDetail', 'Account blocked or verification required.');
            if (isAnonymous) throw new Error('IP_BLOCKED: Even anonymous access is blocked.');
            
            // Retry with Anonymous
            Logger.info('RPA:NoteDetail', 'Switching to Plan B (Anonymous Mode)...');
            await page.close();
            return scrapeNoteDetail(noteId, undefined, true); 
        }
        
        if (status.is404) {
             throw new Error(`NOTE_UNAVAILABLE: Note might be deleted or under review (Note ID: ${noteId})`);
        }

        // --- Data Extraction ---
        // We pass Selectors to evaluate to avoid hardcoding
        // Using string function to avoid compilation artifacts
        const noteData = await page.evaluate(`(selectors) => {
            const state = window.__INITIAL_STATE__;
            
            const parseCount = (str) => {
                if (typeof str === 'number') return str;
                if (!str) return 0;
                if (typeof str === 'string') {
                    if (str.includes('万') || str.includes('w')) {
                        return parseFloat(str.replace(/[万w]/, '')) * 10000;
                    }
                    return parseInt(str, 10) || 0;
                }
                return 0;
            };

            // 1. Try __INITIAL_STATE__ (Preferred)
            if (state && state.note && state.note.noteDetailMap) {
                const keys = Object.keys(state.note.noteDetailMap);
                const noteDetail = keys.length > 0 ? state.note.noteDetailMap[keys[0]].note : null;
                
                if (noteDetail) {
                    let videoUrl = null;
                    if (noteDetail.type === 'video' && noteDetail.video?.media?.stream) {
                        const stream = noteDetail.video.media.stream;
                        if (stream.h264 && stream.h264.length > 0) videoUrl = stream.h264[0].masterUrl;
                        else if (stream.h265 && stream.h265.length > 0) videoUrl = stream.h265[0].masterUrl;
                    }

                    return {
                        title: noteDetail.title || '',
                        content: noteDetail.desc || '',
                        date: noteDetail.time || '',
                        tags: (noteDetail.tagList || []).map(t => t.name),
                        images: (noteDetail.imageList || []).map(img => img.urlDefault || img.url),
                        likes_count: parseCount(noteDetail.interactInfo?.likedCount),
                        collects_count: parseCount(noteDetail.interactInfo?.collectedCount),
                        comments_count: parseCount(noteDetail.interactInfo?.commentCount),
                        is_video: noteDetail.type === 'video',
                        video_url: videoUrl
                    };
                }
            }

            // 2. Fallback to DOM Scraping
            const getText = (sel) => document.querySelector(sel)?.textContent?.trim() || '0';
            
            const title = getText(selectors.NoteDetail.Title);
            const content = getText(selectors.NoteDetail.Content);
            const date = getText(selectors.NoteDetail.Date);
            
            const tags = Array.from(document.querySelectorAll(selectors.NoteDetail.Tags))
                .map(el => el.innerText.replace('#', '').trim());

            const images = Array.from(document.querySelectorAll(selectors.NoteDetail.Media.ImageList))
                .map(img => {
                    const bg = img.style.backgroundImage;
                    if (bg && bg.startsWith('url')) {
                        return bg.replace(/url\\(['"]?(.*?)['"]?\\)/, '$1');
                    }
                    return img.src;
                }).filter(src => src && !src.includes('data:image'));

            const isVideo = !!document.querySelector(selectors.NoteDetail.Media.Video) || 
                           !!document.querySelector(selectors.NoteDetail.Media.VideoContainer);
            const videoUrl = document.querySelector('video')?.src || null;

            return {
                title,
                content,
                date,
                tags: [...new Set(tags)],
                images: [...new Set(images)],
                likes_count: parseCount(getText(selectors.NoteDetail.Stats.Likes)),
                collects_count: parseCount(getText(selectors.NoteDetail.Stats.Collects)),
                comments_count: parseCount(getText(selectors.NoteDetail.Stats.Comments)),
                is_video: isVideo,
                video_url: videoUrl
            };
        }`, Selectors);

        Logger.info('RPA:NoteDetail', `Scraped note ${noteId}: ${noteData.title}`);
        return noteData;

    } catch (error: any) {
        Logger.error('RPA:NoteDetail', `Scrape failed: ${error.message}`, error);
        throw error;
    } finally {
        if (session && session.browser) {
             try { await page.close(); } catch(e) {}
        }
    }
}
