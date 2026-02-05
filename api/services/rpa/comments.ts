
import { BrowserService } from './BrowserService.js';
import db from '../../db.js';
import { Logger } from '../LoggerService.js';
import fs from 'fs';
import path from 'path';
import { CommentAnalysisService } from '../ai/CommentAnalysisService.js';
import { RPAUtils } from './utils/RPAUtils.js';
import { SettingsService } from '../SettingsService.js';

// Safety Configuration
const SAFETY_CONFIG = {
    MAX_ACTIONS_PER_MINUTE: 5,
    MIN_DELAY_MS: 3000,
    MAX_DELAY_MS: 8000,
    DAILY_REPLY_LIMIT: 30
};

const delay = (min = SAFETY_CONFIG.MIN_DELAY_MS, max = SAFETY_CONFIG.MAX_DELAY_MS) => 
    new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1) + min)));

export async function scrapeComments(targetNoteId?: string) {
    // 1. Get Authenticated Page (Prefer MAIN_SITE for Notification Center)
    // We try MAIN_SITE first because /notification is on www.xiaohongshu.com
    // If MAIN_SITE is missing, we try CREATOR as a fallback (cookies might be shared)
    let session;
    try {
        session = await BrowserService.getInstance().getAuthenticatedPage('MAIN_SITE', true); // Headless for background operation
    } catch (e) {
        Logger.warn('RPA:Comments', 'Main Site cookie missing, trying Creator cookie...');
        session = await BrowserService.getInstance().getAuthenticatedPage('CREATOR', true);
    }

    const { browser, page } = session;
    
    // Inject polyfills for environment compatibility
    await RPAUtils.initPage(page);

    // Debug file path
    const debugPath = path.join(process.cwd(), 'data', 'debug_comments_network.json');
    const debugHtmlPath = path.join(process.cwd(), 'data', 'debug_comments_page.html');
    const debugData: any[] = [];

    try {
        if (targetNoteId) {
             Logger.info('RPA:Comments', `Navigating to specific note ${targetNoteId} to monitor comments...`);
        } else {
             Logger.info('RPA:Comments', 'Navigating to Notification Center...');
        }

        // 2. Setup API Interception
        // Store ALL fetched items, not just the last page
        let allCapturedItems: any[] = [];
        const SEVEN_DAYS_AGO = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        const responseHandler = async (response: any) => {
            const url = response.url();
            // Filter for likely API endpoints
            if (url.includes('/api/sns/web/v1/') && response.request().method() === 'GET') {
                try {
                    // Check content type
                    const contentType = response.headers()['content-type'] || '';
                    if (contentType.includes('application/json')) {
                        const json = await response.json();
                        
                        // Capture useful packets
                        // Case A: Notification Center (message, mention, notice)
                        // Case B: Note Detail Comments (comment/list)
                        const isNotification = url.includes('message') || url.includes('mention') || url.includes('notice');
                        const isNoteComments = url.includes('/comment/list') || url.includes('/feed');

                        if (isNotification || isNoteComments) {
                            // Save to debug log
                            debugData.push({ url, data: json });
                            if (debugData.length > 50) debugData.shift();
                            
                            let newItems = [];
                            const dataRoot = json.data || {};
                            
                            if (Array.isArray(dataRoot)) newItems = dataRoot;
                            else if (dataRoot.messages) newItems = dataRoot.messages;
                            else if (dataRoot.message_list) newItems = dataRoot.message_list;
                            else if (dataRoot.comments) newItems = dataRoot.comments; // For note detail
                            
                            if (newItems.length > 0) {
                                Logger.info('RPA:Comments', `Captured page with ${newItems.length} items`);
                                allCapturedItems.push(...newItems);
                            }
                        }
                    }
                } catch (e) {
                    // Ignore JSON parse errors
                }
            }
        };
        
        page.on('response', responseHandler);

        // 3. Navigation & Interaction
        if (targetNoteId) {
            // Navigate to Note Detail Page
            // Try different URL formats: /explore/id or /discovery/item/id
            await page.goto(`https://www.xiaohongshu.com/explore/${targetNoteId}`, { waitUntil: 'domcontentloaded' });
            await delay(3000);
            
            // Open comment section if needed (usually open by default on web, but good to ensure)
            // On web, comments are below content. We need to scroll down.
        } else {
            // Default: Notification Center
            await page.goto('https://www.xiaohongshu.com/notification', { waitUntil: 'domcontentloaded' });
            await delay(3000);

            // Click "Comments and @" tab
            try {
                const commentTab = page.locator('div, span, li').filter({ hasText: /^评论和@$/ }).first();
                if (await commentTab.isVisible()) {
                    await commentTab.click();
                    await delay(2000);
                } else {
                     // Fallback logic...
                     const secondTab = page.locator('.channel-list .channel-item').nth(1);
                     if (await secondTab.count() > 0) {
                         await secondTab.click();
                         await delay(2000);
                     }
                }
            } catch(e) {}
        }

        // 3.1 Scroll Loop for 7 Days of Data
        Logger.info('RPA:Comments', 'Starting scroll loop to fetch 7 days of history...');
        let noNewDataCount = 0;
        let lastItemCount = 0;
        
        // Limit max scrolls to prevent infinite loops (e.g. 20 pages ~ 400 items)
        for (let i = 0; i < 20; i++) {
            // Check if we have data older than 7 days
            if (allCapturedItems.length > 0) {
                // Find the oldest item time
                // Note: items are usually sorted new -> old
                const oldestItem = allCapturedItems[allCapturedItems.length - 1];
                let itemTime = 0;
                if (oldestItem.time) itemTime = oldestItem.time * 1000;
                
                if (itemTime > 0 && itemTime < SEVEN_DAYS_AGO) {
                    Logger.info('RPA:Comments', 'Reached 7 days history limit. Stopping scroll.');
                    break;
                }
            }

            if (allCapturedItems.length === lastItemCount) {
                noNewDataCount++;
            } else {
                noNewDataCount = 0; // Reset if we got new data
            }
            
            lastItemCount = allCapturedItems.length;

            if (noNewDataCount >= 3) {
                Logger.info('RPA:Comments', 'No new data after 3 scrolls. Stopping.');
                break;
            }

            // Scroll down naturally
            // Strategy: Hybrid approach (JS Smooth Scroll + Mouse Wheel)
            // This ensures VISIBLE scrolling (user feedback) and Event triggering (lazy load)
            Logger.info('RPA:Comments', `Scroll #${i + 1} (Hybrid Smooth Scroll)...`);
            
            try {
                // 1. JS Smooth Scroll (Visual & Reliable)
                // We try to find the actual scrollable container first
                await page.evaluate(() => {
                    const scrollAmount = 800;
                    
                    // Heuristic: Find the largest visible element that has scrollable overflow
                    let target: Element | Window = window;
                    let maxArea = 0;
                    
                    const candidates = Array.from(document.querySelectorAll('div, section, main, ul'));
                    for (const el of candidates) {
                        const style = window.getComputedStyle(el);
                        const isScrollable = (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
                        
                        if (isScrollable) {
                            const rect = el.getBoundingClientRect();
                            // Must be visible
                            if (rect.width > 0 && rect.height > 0) {
                                const area = rect.width * rect.height;
                                // Prefer larger areas (main content) over small ones (sidebars)
                                if (area > maxArea) {
                                    maxArea = area;
                                    target = el;
                                }
                            }
                        }
                    }
                    
                    // Execute Smooth Scroll
                    target.scrollBy({ top: scrollAmount, behavior: 'smooth' });
                });
                
                // 2. Physical Mouse Wheel (Backup & Event Trigger)
                // Move mouse to "safe zone" (center-right) to avoid left sidebar
                const vp = page.viewportSize();
                if (vp) {
                    await page.mouse.move(vp.width * 0.6, vp.height * 0.5);
                    await delay(100);
                    await page.mouse.wheel(0, 600);
                }
                
            } catch (e: any) {
                Logger.warn('RPA:Comments', `Scroll failed: ${e.message}`);
            }
            
            Logger.info('RPA:Comments', `Total Captured Items so far: ${allCapturedItems.length}`);
            
            // Wait for network and render
            await delay(2000, 4000);
        }

        // Write debug file
        if (!fs.existsSync(path.dirname(debugPath))) fs.mkdirSync(path.dirname(debugPath), { recursive: true });
        fs.writeFileSync(debugPath, JSON.stringify(debugData, null, 2));

        // 4. Data Extraction & Normalization
        let items: any[] = [];

        if (allCapturedItems.length > 0) {
            Logger.info('RPA:Comments', `Processing ${allCapturedItems.length} raw items from API`);
            
            // Deduplicate by ID
            const uniqueMap = new Map();
            
            allCapturedItems.forEach((item: any) => {
                // ... (Parsing logic similar to before)
                let parsedItem = null;
                
                if (item.type === 'mention/comment' || item.type === 'comment/comment') {
                    const userInfo = item.user_info || {};
                    const commentInfo = item.comment_info || {};
                    const noteInfo = item.note_info || {}; // Capture Note Info if available

                    parsedItem = {
                        user_nickname: userInfo.nickname || 'Unknown',
                        user_avatar: userInfo.image || '',
                        content: commentInfo.content || item.title || 'New Interaction',
                        create_time_str: item.time ? new Date(item.time * 1000).toISOString() : new Date().toISOString(),
                        id: commentInfo.id || item.id || '',
                        reply_status: 'UNREAD',
                        type: item.type === 'mention/comment' ? 'MENTION' : 'COMMENT',
                        root_note_id: commentInfo.note_id || noteInfo.id || ''
                    };
                } else {
                    // Legacy fallback
                    const user = item.from_user || item.user || item.userInfo || {};
                    parsedItem = {
                        user_nickname: user.nickname || 'Unknown',
                        user_avatar: user.images || user.avatar || '',
                        content: item.content || item.target_note?.title || 'New Interaction',
                        create_time_str: new Date(item.time || Date.now()).toLocaleString(),
                        id: item.id || '',
                        reply_status: 'UNREAD',
                        type: 'COMMENT', // Default to comment for unknown types
                        root_note_id: item.target_note?.id || ''
                    };
                }

                if (parsedItem && parsedItem.user_nickname !== 'Unknown') {
                    uniqueMap.set(parsedItem.id, parsedItem);
                }
            });
            
            items = Array.from(uniqueMap.values());
        }
        
        // Method B: DOM Scraping (Fallback)
        if (items.length === 0) {
            Logger.warn('RPA:Comments', 'API failed, using DOM Scraper');
            
            // Dump HTML for diagnosis
            const html = await page.content();
            fs.writeFileSync(debugHtmlPath, html);

            items = await page.evaluate(() => {
                // Broadest possible selector for notification items
                const nodes = Array.from(document.querySelectorAll('.message-item, .notification-item, .item-container, div[class*="item"]'));
                
                return nodes.map((el: any) => {
                    const text = el.innerText || '';
                    if (text.length < 5) return null; // Skip empty noise
                    
                    // Basic extraction
                    const userEl = el.querySelector('.user-name, .nickname, .name, h4, span[class*="name"]');
                    const contentEl = el.querySelector('.content, .desc, .comment, p, span[class*="content"]');
                    const imgEl = el.querySelector('img');
                    
                    // Detect if it's a mention
                    const isMention = text.includes('@了你') || text.includes('提到了你');

                    if (!userEl || !contentEl) return null;
                    if (text.includes('赞了') || text.includes('收藏了') || text.includes('关注了')) return null;

                    return {
                        user_nickname: userEl.innerText.trim(),
                        user_avatar: imgEl ? imgEl.src : '',
                        content: contentEl.innerText.trim(),
                        create_time_str: new Date().toLocaleString(), // Approximate
                        id: el.getAttribute('data-id') || Math.random().toString(36).substr(2, 9),
                        reply_status: 'UNREAD',
                        type: isMention ? 'MENTION' : 'COMMENT',
                        root_note_id: '' // Hard to get note ID from DOM list view without link parsing
                    };
                }).filter(i => i !== null);
            });
        }

        Logger.info('RPA:Comments', `Extracted ${items.length} items`);

        // 5. Save to DB
        if (items.length > 0) {
            const activeAccount = db.prepare('SELECT id FROM accounts WHERE is_active = 1').get() as { id: number };
            
            if (!activeAccount) {
                throw new Error('No active account found. Please activate an account in the Account Matrix first.');
            }

            const stmt = db.prepare(`
                INSERT INTO comments (id, user_nickname, user_avatar, content, create_time, reply_status, account_id, type, root_note_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET 
                    reply_status=excluded.reply_status,
                    create_time=excluded.create_time,
                    type=excluded.type,
                    root_note_id=excluded.root_note_id
            `);

            const insertTransaction = db.transaction((comments) => {
                for (const item of comments) {
                    // Normalization
                    const id = item.id || `cmt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                    const nick = item.user_nickname || item.from_user?.nickname || 'Unknown';
                    const avatar = item.user_avatar || item.from_user?.images || '';
                    const content = item.content || item.target_note?.title || '';
                    
                    stmt.run(id, nick, avatar, content, item.create_time_str, item.reply_status || 'UNREAD', activeAccount.id, item.type || 'COMMENT', item.root_note_id || '');
                }
            });
            insertTransaction(items);
            
            // Trigger AI Analysis for newly added comments
            const autoReplyEnabled = await SettingsService.get('AUTO_REPLY_ENABLED');
            
            if (autoReplyEnabled === 'true') {
                Logger.info('RPA:Comments', 'Triggering AI analysis for new comments...');
                try {
                    // Get limit from settings, default to 20
                    const limitStr = await SettingsService.get('AI_ANALYSIS_LIMIT');
                    const limit = limitStr ? parseInt(limitStr, 10) : 20;

                    // Analyze up to [limit] unanalyzed comments
                    // We use setTimeout to run it in background after response
                    // But since we are in a worker or task context, better await it or let it run
                    await CommentAnalysisService.processUnanalyzedComments(limit);
                } catch (e: any) {
                    Logger.error('RPA:Comments', `AI Analysis failed: ${e.message}`);
                }
            } else {
                Logger.info('RPA:Comments', 'Auto Reply Analysis skipped (Disabled in Settings)');
            }
        }

        return { success: true, count: items.length };

    } catch (error: any) {
        Logger.error('RPA:Comments', `Scrape failed: ${error.message}`, error);
        throw error;
    } finally {
        if (page) {
            try { await page.close(); } catch(e) {}
        }
    }
}

export async function replyToComment(commentId: string, replyContent: string) {
    // Safety Check: Sensitive Words
    const FORBIDDEN_WORDS = ['加v', '私', '微信号', '公众号', '代购', '淘宝', '天猫', '京东', '拼多多', '链接', 'http'];
    for (const word of FORBIDDEN_WORDS) {
        if (replyContent.includes(word)) {
            throw new Error(`Safety Violation: Reply contains forbidden word "${word}". Operation blocked.`);
        }
    }

    // [Change] Use Notification Center for replies to ensure consistency with scraping
    const session = await BrowserService.getInstance().getAuthenticatedPage('MAIN_SITE', true);
    const { browser, page } = session;

    // Inject polyfills
    await RPAUtils.initPage(page);

    try {
        await page.goto('https://www.xiaohongshu.com/notification', { waitUntil: 'domcontentloaded' });
        await delay(3000);

        // Click "Comments and @" tab to filter view
        try {
            const commentTab = page.locator('div, span, li').filter({ hasText: /^评论和@$/ }).first();
            if (await commentTab.isVisible()) {
                await commentTab.click();
                await delay(2000);
            }
        } catch(e) {}
        
        Logger.info('RPA:Reply', `Locating comment ${commentId}...`);
        
        const comment = db.prepare('SELECT content, user_nickname FROM comments WHERE id = ?').get(commentId) as any;
        if (!comment) throw new Error('Comment not found in DB');

        // Strategy 1: Try ID match (if we scraped it from DOM data-id)
        let commentLocator = page.locator(`[data-id="${commentId}"]`).first();
        
        // Strategy 2: Text Content Match (Robust Fallback)
        if (await commentLocator.count() === 0) {
            Logger.info('RPA:Reply', 'ID match failed, trying text content match...');
            // Normalize content for matching (remove whitespace issues)
            const cleanContent = comment.content.trim().substring(0, 15); 
            
            // Find the Content Element first (most unique part)
            // We look for a generic text element containing the content
            const contentEl = page.locator(`:text("${cleanContent}")`).first();
            
            if (await contentEl.count() === 0) {
                 await Logger.saveScreenshot(page, 'reply-content-not-found');
                 throw new Error(`Could not find comment with text: ${cleanContent}`);
            }

            // Navigate up to find the Container (Card) that also has the User Nickname
            // We assume the card is within 6 levels up (HTML structure depth)
            // XPath: Find an ancestor div that contains the nickname
            // Note: xpath is 1-based.
            const cardXpath = `xpath=./ancestor::div[contains(., "${comment.user_nickname}")][1]`;
            commentLocator = contentEl.locator(cardXpath);
        }
        
        if (await commentLocator.count() === 0) {
             await Logger.saveScreenshot(page, 'reply-card-not-found');
             throw new Error('Comment container not found. (Pagination not yet supported)');
        }

        // Highlight the found card for visual debugging in screenshots
        await commentLocator.evaluate((el: any) => el.style.border = '3px solid red');
        await commentLocator.scrollIntoViewIfNeeded();
        await delay(1000);

        // 2. Check if Input is ALREADY Visible (e.g. previously clicked)
        // Heuristic: If there is a "取消" (Cancel) button, the input is likely open.
        let cancelButton = commentLocator.locator('button, div, span').filter({ hasText: /^取消$/ }).first();
        let isInputOpen = await cancelButton.isVisible().catch(() => false);
        
        let input = commentLocator.locator('textarea, [contenteditable="true"], [role="textbox"]').first();

        if (!isInputOpen) {
            // 3. Click Reply Button
            // We iterate through all elements containing "回复" and pick the one that is exactly "回复"
            // This avoids "回复了你的评论" or "回复中"
            
            const candidates = commentLocator.locator(':text("回复")');
            const count = await candidates.count();
            let replyBtn = null;

            for (let i = 0; i < count; i++) {
                const el = candidates.nth(i);
                const text = await el.innerText();
                if (text && text.trim() === '回复') {
                    // Double check it's not the status line (usually gray color, but hard to check in code)
                    // We assume the action button is clickable or has a specific role, 
                    // but simple text match is usually enough if length is strict.
                    replyBtn = el;
                    break;
                }
            }

            if (replyBtn) {
                 await replyBtn.click();
            } else {
                 // Try hovering first (sometimes buttons appear on hover)
                 await commentLocator.hover();
                 await delay(500);
                 
                 // Re-scan after hover
                 const candidatesAfterHover = commentLocator.locator(':text("回复")');
                 const countAfter = await candidatesAfterHover.count();
                 for (let i = 0; i < countAfter; i++) {
                    const el = candidatesAfterHover.nth(i);
                    const text = await el.innerText();
                    if (text && text.trim() === '回复') {
                        replyBtn = el;
                        break;
                    }
                 }
                 
                 if (replyBtn) {
                     await replyBtn.click();
                 } else {
                     await Logger.saveScreenshot(page, 'reply-btn-not-found');
                     throw new Error('Reply button not found (checked exact "回复" text)');
                 }
            }
            
            // Wait for input
            try {
                input = commentLocator.locator('textarea, [contenteditable="true"], [role="textbox"]').first();
                await input.waitFor({ state: 'visible', timeout: 5000 });
            } catch (e) {
                 await Logger.saveScreenshot(page, 'reply-input-timeout');
                 throw new Error('Input box did not appear after clicking reply');
            }
        } else {
            Logger.info('RPA:Reply', 'Input box already visible (found "取消" button)');
        }

        // 4. Type Content
        // Use pressSequentially to mimic human typing and ensure event listeners (React/Vue) trigger correctly
        await input.clear(); // Clear first just in case
        await input.pressSequentially(replyContent, { delay: 100 });
        await delay(1000);

        // 5. Submit
        Logger.info('RPA:Reply', 'Locating Submit button...');
        
        // Strategy: Search within the card for the button
        // We iterate through ALL candidates to find the one that is actually visible.
        // Relaxed regex to handle whitespace
        const submitCandidates = commentLocator.locator('button, div[role="button"], span').filter({ hasText: /^\s*发送\s*$/ });
        const candidateCount = await submitCandidates.count();
        let submitBtn = null;

        for (let i = 0; i < candidateCount; i++) {
            const btn = submitCandidates.nth(i);
            // Check visibility
            if (await btn.isVisible()) {
                submitBtn = btn;
                Logger.info('RPA:Reply', `Found visible Submit button at index ${i}`);
                break;
            }
        }

        if (submitBtn) {
            // Highlight it for user to see
            await submitBtn.evaluate((el: any) => el.style.border = '3px solid green');
            await delay(500); // Visual confirmation
            await submitBtn.click();
        } else {
            // Last Resort: Search GLOBALLY for a "发送" button that is visibly close to our input?
            // Or just fail. We should NOT press Enter as it causes newlines.
            await Logger.saveScreenshot(page, 'reply-submit-not-found');
            throw new Error('Submit button ("发送") not found in the card.');
        }
        
        // 6. Verify Submission
        await delay(2000);
        
        // Check if input is cleared or detached
        const isInputAttached = await input.isVisible().catch(() => false);
        if (isInputAttached) {
             const remainingText = await input.inputValue().catch(() => '');
             if (remainingText && remainingText.trim().length > 0) {
                 await Logger.saveScreenshot(page, 'reply-stuck');
                 throw new Error('Reply failed: Text still remains in input. Button click might have failed.');
             }
        }
        
        Logger.info('RPA:Reply', 'Reply submitted successfully (Input cleared)');
        await delay(3000, 5000);

        // Fix: Use single quotes for string literal in SQL
        db.prepare("UPDATE comments SET reply_status = 'REPLIED' WHERE id = ?").run(commentId);

        return { success: true };

    } catch (error: any) {
        Logger.error('RPA:Reply', `Reply failed: ${error.message}`, error);
        throw error;
    } finally {
        if (page) {
            try { await page.close(); } catch(e) {}
        }
    }
}
