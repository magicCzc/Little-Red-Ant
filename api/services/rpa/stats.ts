
import db from '../../db.js';
import { launchBrowser, createBrowserContext } from './utils.js';
import { getCookies } from './auth.js';
import { RPAUtils } from './utils/RPAUtils.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../LoggerService.js';
import { Page } from 'playwright';
import { Selectors } from './config/selectors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, '../../../../public/screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function takeProgressScreenshot(page: Page, taskId: string) {
    if (!taskId) return;
    try {
        const filePath = path.join(SCREENSHOT_DIR, `${taskId}.jpg`);
        await page.screenshot({ path: filePath, quality: 60, type: 'jpeg' });
    } catch (e) {
        console.error('Failed to take progress screenshot', e);
    }
}

export async function scrapeNoteStats(taskId?: string) {
    const storageState = getCookies('CREATOR');
    if (!storageState) throw new Error('Please bind "Creation Permission" first');
    
    // Use headed mode for better stability and visibility
    const browser = await launchBrowser(false); 
    let page: any;
    
    try {
        const context = await createBrowserContext(browser, storageState);
        page = await context.newPage();
        
        await takeProgressScreenshot(page, taskId!);
        const capturedNotes: any[] = [];
        
        // Debug file path
        const debugPath = path.join(process.cwd(), 'data', 'debug_network_responses.json');
        const debugData: any[] = [];

        // 1. Setup API Interception
        page.on('response', async (response: any) => {
             const url = response.url();
             if (url.includes('xiaohongshu.com') && (response.request().resourceType() === 'fetch' || response.request().resourceType() === 'xhr')) {
                try {
                    if (!url.includes('/api/') && !url.includes('/v1/') && !url.includes('/note/')) return;

                    const json = await response.json();
                    
                    if (url.includes('note')) {
                        debugData.push({ url, data: json });
                        if (debugData.length > 20) debugData.shift();
                        fs.writeFileSync(debugPath, JSON.stringify(debugData, null, 2));
                    }

                    const data = json.data?.data || json.data;
                    if (!data) return;

                    let list = [];
                    if (data.notes) list = data.notes;
                    else if (data.list) list = data.list;
                    else if (Array.isArray(data)) list = data;
                    
                    if (url.includes('note_detail') || url.includes('note/base')) {
                        const noteInfo = data.note_info || data;
                        if (noteInfo && (noteInfo.id || noteInfo.note_id)) list = [noteInfo];
                    }

                    if (list.length > 0) {
                         console.log(`[Scraper] Found ${list.length} items in ${url}`);
                         list.forEach((item: any) => {
                             const noteId = item.note_id || item.id || item.noteId;
                             let title = item.title || item.display_title || 'Untitled';
                             if (title === 'Untitled' && item.caption) title = item.caption.split('\n')[0].substring(0, 30);
                             else if (title === 'Untitled' && item.desc) title = item.desc.split('\n')[0].substring(0, 30);

                             let cover = item.coverUrl || item.cover?.url || item.cover_image || '';
                             if (!cover && item.images_list?.length > 0) cover = item.images_list[0].url;
                             if (!cover && item.images_list_v2?.length > 0) cover = item.images_list_v2[0].url;

                            let pubDate = '';
                            const ts = item.create_time || item.time || item.upload_time || item.pub_time || item.display_time || item.last_update_time;
                            if (ts) {
                                if (!isNaN(Number(ts))) {
                                    const numTs = Number(ts);
                                    const date = new Date(numTs > 10000000000 ? numTs : numTs * 1000); 
                                    if (!isNaN(date.getTime())) {
                                        pubDate = date.toISOString();
                                    }
                                } 
                                else if (typeof ts === 'string') {
                                    const date = new Date(ts);
                                    if (!isNaN(date.getTime())) {
                                        pubDate = date.toISOString();
                                    }
                                }
                            }

                            const xsecToken = item.xsec_token || item.note_card?.xsec_token || '';
                             
                             const interact = item.interact_info || {};
                             let views = item.read_count || item.view_count || interact.read_count || interact.view_count || 0;
                             let likes = item.likes || item.like_count || interact.liked_count || interact.likes || 0;
                             let comments = item.comments || item.comment_count || interact.comment_count || item.reply_count || 0;
                             let collects = item.collects || item.collect_count || interact.collected_count || interact.collect_count || item.fav_count || 0;

                             const n = {
                                 note_id: noteId,
                                 title: title,
                                 cover_image: cover,
                                 publish_date: pubDate,
                                 views: Number(views) || 0,
                                 likes: Number(likes) || 0,
                                 comments: Number(comments) || 0,
                                collects: Number(collects) || 0,
                                xsec_token: xsecToken
                            };
                            if (n.cover_image?.startsWith('http://')) n.cover_image = n.cover_image.replace('http://', 'https://');

                            if (n.note_id) {
                                const existingIdx = capturedNotes.findIndex(x => x.note_id === n.note_id);
                                if (existingIdx !== -1) {
                                    const ex = capturedNotes[existingIdx];
                                    capturedNotes[existingIdx] = {
                                        ...ex,
                                        views: Math.max(ex.views, n.views),
                                        likes: Math.max(ex.likes, n.likes),
                                        comments: Math.max(ex.comments, n.comments),
                                        collects: Math.max(ex.collects, n.collects),
                                        title: n.title !== 'Untitled' ? n.title : ex.title,
                                        cover_image: n.cover_image || ex.cover_image,
                                        publish_date: n.publish_date || ex.publish_date,
                                        xsec_token: n.xsec_token || ex.xsec_token
                                    };
                                } else {
                                    capturedNotes.push(n);
                                }
                            }
                         });
                    }
                } catch (e) {}
             }
        });

        // 2. Navigation
        await page.goto('https://creator.xiaohongshu.com/creator/home', { waitUntil: 'domcontentloaded' });
        await takeProgressScreenshot(page, taskId!);
        await page.waitForTimeout(3000);

        if (page.url().includes('/login')) throw new Error('创作中心登录已过期，请重新绑定“创作发布权限”');

        // Inject polyfills for environment compatibility
        await RPAUtils.initPage(page);

        const isLoggedIn = await page.evaluate((selectors: any) => {
            return !!document.querySelector(selectors.Common.Login.LoggedInIndicators.Creator);
        }, Selectors);
        if (!isLoggedIn) throw new Error('无法进入创作中心，可能需要进行验证码验证或重新登录');

        console.log('[Scraper] Navigating to Note Management page...');
        await page.goto('https://creator.xiaohongshu.com/new/note-manager', { waitUntil: 'domcontentloaded' });
        await takeProgressScreenshot(page, taskId!);
        
        // 3. Expose function for DOM scraper
        const domNotesMap = new Map<string, any>();
        await page.exposeFunction('saveDomNotes', (notes: any[]) => {
            notes.forEach(n => {
                if (n.note_id && !domNotesMap.has(n.note_id)) domNotesMap.set(n.note_id, n);
            });
        });

        // 4. Run Browser Logic (Structured)
        await page.evaluate(async (selectors: any) => {
            return new Promise((resolve) => {
                let total = 0;
                let noChangeCount = 0;
                
                const getStatsFromItem = (el: any) => {
                    const stats = { views: 0, likes: 0, comments: 0, collects: 0 };
                    
                    const parseNum = (str: any) => {
                        if (!str) return 0;
                        if (str.includes('w') || str.includes('W') || str.includes('万')) {
                            return parseFloat(str) * 10000;
                        }
                        return parseInt(str.replace(/[^0-9]/g, '')) || 0;
                    };

                    // Strategy 1: Icon-based
                    const findNumByIcon = (iconPatterns: string[]) => {
                        for (const pattern of iconPatterns) {
                            const icon = el.querySelector('[class*="' + pattern + '"]') || el.querySelector('svg[class*="' + pattern + '"]');
                            if (icon) {
                                const parent = icon.parentElement;
                                const text = parent?.innerText || icon.nextElementSibling?.innerText || '';
                                const num = parseNum(text);
                                if (num > 0) return num;
                            }
                        }
                        return null;
                    };

                    const v = findNumByIcon(selectors.CreatorCenter.Stats.Icons.Views);
                    const l = findNumByIcon(selectors.CreatorCenter.Stats.Icons.Likes);
                    const c = findNumByIcon(selectors.CreatorCenter.Stats.Icons.Comments);
                    const s = findNumByIcon(selectors.CreatorCenter.Stats.Icons.Collects);

                    if (v !== null) stats.views = v;
                    if (l !== null) stats.likes = l;
                    if (c !== null) stats.comments = c;
                    if (s !== null) stats.collects = s;

                    // Strategy 2: Keyword Regex
                    const getStatByKeyword = (keywords: string[]) => {
                         const text = el.innerText || '';
                         for (const kw of keywords) {
                             const regex = new RegExp('(\\d+[\\d\\.]*[kw]?)\\s*[\\n\\s]*' + kw + '|' + kw + '\\s*[\\n\\s]*(\\d+[\\d\\.]*[kw]?)', 'i');
                             const match = text.match(regex);
                             if (match) return parseNum(match[1] || match[2]);
                         }
                         return 0;
                    };

                    if (stats.views === 0) stats.views = getStatByKeyword(selectors.CreatorCenter.Stats.Keywords.Views);
                    if (stats.likes === 0) stats.likes = getStatByKeyword(selectors.CreatorCenter.Stats.Keywords.Likes);
                    if (stats.comments === 0) stats.comments = getStatByKeyword(selectors.CreatorCenter.Stats.Keywords.Comments);
                    if (stats.collects === 0) stats.collects = getStatByKeyword(selectors.CreatorCenter.Stats.Keywords.Collects);

                    // Strategy 3: Positional Fallback
                    if (stats.views === 0 && stats.likes === 0 && stats.comments === 0 && stats.collects === 0) {
                        const text = el.innerText || '';
                        const parts = text.split(/[\s\n]+/).map((p: string) => p.trim());
                        const numbers: number[] = [];
                        for (const p of parts) {
                            if (/^\d+(\.\d+)?[kw]?$/.test(p)) {
                                const val = parseFloat(p);
                                if (val > 2020 && val < 2035 && p.length === 4) continue;
                                numbers.push(parseNum(p));
                            }
                        }
                        if (numbers.length >= 4) {
                            stats.views = numbers[0];
                            stats.likes = numbers[1];
                            stats.comments = numbers[2];
                            stats.collects = numbers[3]; 
                        }
                    }

                    return stats;
                }

                const scrapeVisible = () => {
                    const items = Array.from(document.querySelectorAll(selectors.CreatorCenter.NoteList.Item));
                    
                    const batch = items.map((el: any) => {
                        let noteId = el.getAttribute('data-note-id');
                        if (!noteId) {
                            const link = el.querySelector('a[href*="/explore/"], a[href*="/item/"]');
                            if (link) {
                                const href = link.getAttribute('href');
                                if (href) noteId = href.split('/').pop();
                            }
                        }
                        
                        if (!noteId) return null;
                        
                        let title = 'Untitled';
                        const titleEl = el.querySelector(selectors.CreatorCenter.NoteList.Title);
                        if (titleEl) title = titleEl.innerText.trim();
                        
                        let cover = '';
                        const imgEl = el.querySelector(selectors.CreatorCenter.NoteList.Image);
                        if (imgEl) cover = imgEl.src;
                        
                        const stats = getStatsFromItem(el);
                        
                        let pubDate = '';
                        const dateMatch = el.innerText.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})/);
                        if (dateMatch) {
                            pubDate = dateMatch[1];
                        } else {
                            const today = new Date();
                            if (el.innerText.includes('昨天')) {
                                today.setDate(today.getDate() - 1);
                                pubDate = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
                            } else if (el.innerText.includes('前天')) {
                                today.setDate(today.getDate() - 2);
                                pubDate = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
                            } else if (el.innerText.match(/(\d+)天前/)) {
                                const days = parseInt(RegExp.$1);
                                today.setDate(today.getDate() - days);
                                pubDate = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
                            }
                        }
                        
                        return { 
                            note_id: noteId, 
                            title, 
                            cover_image: cover, 
                            views: stats.views, 
                            likes: stats.likes, 
                            comments: stats.comments, 
                            collects: stats.collects, 
                            publish_date_str: pubDate 
                        };
                    }).filter(n => n !== null);
                    
                    if ((window as any).saveDomNotes) {
                        (window as any).saveDomNotes(batch);
                    }
                }

                const timer = setInterval(() => {
                    let scroller = document.documentElement as Element;
                    const candidates = document.querySelectorAll('div, main, section, .layout-container, .content-container');
                    let maxScroll = 0;
                    
                    candidates.forEach(el => {
                        const style = window.getComputedStyle(el);
                        const isScrollable = (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
                        if (isScrollable && el.scrollHeight > maxScroll) {
                            maxScroll = el.scrollHeight;
                            scroller = el;
                        }
                    });

                    const scrollStep = 300 + Math.floor(Math.random() * 200);
                    if (scroller === document.documentElement) {
                        window.scrollBy(0, scrollStep);
                    } else {
                        scroller.scrollBy(0, scrollStep);
                    }
                    
                    scrapeVisible();

                    total += scrollStep;
                    
                    const currentScrollTop = scroller === document.documentElement ? window.scrollY : scroller.scrollTop;
                    const clientHeight = scroller === document.documentElement ? window.innerHeight : scroller.clientHeight;
                    const scrollHeight = scroller.scrollHeight;
                    
                    const isAtBottom = Math.ceil(currentScrollTop + clientHeight) >= scrollHeight - 50;

                    if (isAtBottom) {
                        noChangeCount++;
                    } else {
                        noChangeCount = 0; 
                    }

                    if(total > 100000 || noChangeCount > 50) { 
                        clearInterval(timer); 
                        resolve(undefined);
                    }
                }, 500); 
            });
        }, Selectors);
        
        await takeProgressScreenshot(page, taskId!);
        await page.waitForTimeout(3000); 

        // 5.1 Fetch xsec_token
        let userId = '';
        try {
            const userState = await page.evaluate(() => { return (window as any).__INITIAL_STATE__; });
            userId = userState?.user?.user?.userId || userState?.user?.user_id || userState?.user?.id;
        } catch (e) {}

        if (!userId) {
            const cookies = await context.cookies();
            const useridCookie = cookies.find((c: any) => c.name === 'userid');
            if (useridCookie) userId = useridCookie.value;
        }

        if (userId) {
            console.log(`[Scraper] Found User ID: ${userId}, navigating to profile for tokens...`);
            const activeAccount = db.prepare('SELECT id FROM accounts WHERE is_active = 1').get() as { id: number };
            if (activeAccount) {
                db.prepare('UPDATE accounts SET user_id = ? WHERE id = ?').run(userId, activeAccount.id);
            }

            try {
                await page.goto(`https://www.xiaohongshu.com/user/profile/${userId}`, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(2000);
                await page.evaluate(() => window.scrollBy(0, 500));
                await page.waitForTimeout(3000);
            } catch (e) {
                console.error('[Scraper] Failed to visit profile page:', e);
            }
        }

        // 5. Merge Data
        if (domNotesMap.size > 0) {
            console.log(`[Scraper] DOM Scraper found ${domNotesMap.size} unique notes`);
            for (const [id, note] of domNotesMap) {
                const existingIdx = capturedNotes.findIndex(x => x.note_id === id);
                
                const parseDateStr = (str: string) => {
                    try {
                        let cleanStr = str.replace(/周[一二三四五六日]/, '').trim();
                        cleanStr = cleanStr.replace(/\//g, '-');
                        const d = new Date(cleanStr);
                        if (!isNaN(d.getTime())) return d.toISOString();
                    } catch(e) {}
                    return null;
                };

                if (existingIdx === -1) {
                    if (note.publish_date_str) {
                        const parsed = parseDateStr(note.publish_date_str);
                        if (parsed) note.publish_date = parsed;
                        delete note.publish_date_str;
                    }
                    capturedNotes.push(note);
                } else {
                    const ex = capturedNotes[existingIdx];
                    if (!ex.publish_date && note.publish_date_str) {
                         const parsed = parseDateStr(note.publish_date_str);
                         if (parsed) ex.publish_date = parsed;
                    }
                    if (note.collects > 0 && ex.collects === 0) ex.collects = note.collects;
                    if (note.comments > 0 && ex.comments === 0) ex.comments = note.comments;
                    if (note.likes > 0 && ex.likes === 0) ex.likes = note.likes;
                }
            }
        }

        // 6. Save to DB
        const activeAccount = db.prepare('SELECT id FROM accounts WHERE is_active = 1').get() as { id: number };
        if (!activeAccount) {
            console.error('[Scraper] No active account found for saving stats.');
            return { success: false, count: 0 };
        }

        const stmt = db.prepare(`INSERT INTO note_stats (note_id, title, cover_image, views, likes, comments, collects, publish_date, account_id, xsec_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const updateStmt = db.prepare(`UPDATE note_stats SET title=?, cover_image=?, views=?, likes=?, comments=?, collects=?, publish_date=COALESCE(?, publish_date), xsec_token=COALESCE(?, xsec_token), record_date=CURRENT_TIMESTAMP WHERE note_id = ? AND account_id = ?`);
        
        const transaction = db.transaction((notes) => {
            let updatedCount = 0;
            let insertedCount = 0;

            for (const note of notes) {
                const exists = db.prepare('SELECT * FROM note_stats WHERE note_id = ? AND account_id = ?').get(note.note_id, activeAccount.id) as any;
                
                if (exists) {
                    const safeViews = (note.views === 0 && exists.views > 10) ? exists.views : note.views;
                    const safeLikes = (note.likes === 0 && exists.likes > 5) ? exists.likes : note.likes;
                    const safeComments = (note.comments === 0 && exists.comments > 5) ? exists.comments : note.comments;
                    const safeCollects = (note.collects === 0 && exists.collects > 5) ? exists.collects : note.collects;

                    if (note.views === 0 && exists.views > 100) {
                        Logger.warn('RPA:Stats', `Prevented zero-overwrite for note ${note.note_id} (views: ${exists.views} -> 0)`);
                    }

                    updateStmt.run(
                        note.title || exists.title, 
                        note.cover_image || exists.cover_image, 
                        safeViews, 
                        safeLikes, 
                        safeComments, 
                        safeCollects, 
                        note.publish_date || null,
                        note.xsec_token || null, 
                        note.note_id, 
                        activeAccount.id
                    );
                    updatedCount++;
                } else {
                    if (note.title && note.title !== 'Untitled') {
                        stmt.run(note.note_id, note.title, note.cover_image, note.views, note.likes, note.comments, note.collects, note.publish_date || null, activeAccount.id, note.xsec_token || null);
                        insertedCount++;
                    }
                }
                
                const finalViews = exists ? ((note.views === 0 && exists.views > 10) ? exists.views : note.views) : note.views;
                const finalLikes = exists ? ((note.likes === 0 && exists.likes > 5) ? exists.likes : note.likes) : note.likes;
                const finalComments = exists ? ((note.comments === 0 && exists.comments > 5) ? exists.comments : note.comments) : note.comments;
                const finalCollects = exists ? ((note.collects === 0 && exists.collects > 5) ? exists.collects : note.collects) : note.collects;

                db.prepare(`INSERT INTO note_stats_history (note_id, views, likes, comments, collects, shares) VALUES (?, ?, ?, ?, ?, 0)`).run(note.note_id, finalViews, finalLikes, finalComments, finalCollects);
            }
            console.log(`[Stats] Sync Complete. Updated: ${updatedCount}, Inserted: ${insertedCount}`);
        });
        transaction(capturedNotes);
        return { success: true, count: capturedNotes.length };

    } catch (e: any) {
        Logger.error('RPA:Stats', `Scrape failed: ${e.message}`, e);
        if (page) {
            await Logger.saveScreenshot(page, 'scrape-failed');
            await takeProgressScreenshot(page, taskId!);
        }
        throw e;
    } finally {
        if (browser) await browser.close();
    }
}
