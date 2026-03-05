
import { fileURLToPath } from 'url';
import { Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { BrowserService } from './BrowserService.js';
import { DATA_DIR } from './utils.js';
import { Logger } from '../LoggerService.js';
import { Selectors } from './config/selectors.js';
import { RPAUtils } from './utils/RPAUtils.js';
import { config } from '../../config.js';

const SCREENSHOT_DIR = path.join(config.paths.public, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
    try {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    } catch (e) {
        console.error('[Publish] Failed to create screenshot directory:', e);
    }
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

export async function openPublishPageWithContent(note: { 
    title: string, content: string, tags: string[], imageData?: string[], videoPath?: string, autoPublish?: boolean, accountId?: number, contentType?: string 
}, taskId?: string) {
  // Use BrowserService for unified session management
  const session = await BrowserService.getInstance().getAuthenticatedPage('CREATOR', true, note.accountId); // Headless = true
  let { browser, page } = session; // Changed to let to allow reassignment
  
  // Inject polyfills for environment compatibility
  await RPAUtils.initPage(page);
  
  // --- Network Interception for Note ID (Robust Fallback) ---
  let capturedNoteId: string | undefined;
  let capturedNoteUrl: string | undefined;

  // Listen for publish API response
  page.on('response', async (response) => {
      try {
          const url = response.url();
          // Match publish endpoints (cover v1/feed/post, v3/note/post, etc.)
          if (url.includes('/api/sns/web/') && url.includes('/post') && response.request().method() === 'POST') {
              Logger.info('RPA:Publish', `Detected publish API call: ${url}`);
              const status = response.status();
              if (status >= 200 && status < 300) {
                  const json = await response.json().catch(() => null);
                  if (json && json.data) {
                      // XHS API usually returns data.id or data.noteId
                      const id = json.data.id || json.data.noteId || json.data.note_id;
                      if (id) {
                          capturedNoteId = id;
                          capturedNoteUrl = `https://www.xiaohongshu.com/explore/${id}`;
                          Logger.info('RPA:Publish', `Interceptor captured Note ID: ${id}`);
                      }
                  }
              }
          }
      } catch (e) {
          // Ignore json parse errors or others
      }
  });
  // ---------------------------------------------------------

  await takeProgressScreenshot(page, taskId!);

  // Prepare Media
  let filePaths: string[] = [];
  let isVideo = false;
  let isArticle = note.contentType === 'article';

  if (note.videoPath) {
      isVideo = true;
      isArticle = false; // Video takes precedence or override
      let vPath = note.videoPath;
      if (vPath.startsWith('http')) {
          // Future: Download logic
      }
      filePaths.push(vPath);
  } else if (!isArticle) {
      // Handle Images (Only if not article)
      const inputImages = Array.isArray(note.imageData) ? note.imageData : (note.imageData ? [note.imageData] : []);
      
      // FAIL FAST: Image Mode requires images
      if (inputImages.length === 0) {
          throw new Error('Publish Error: Image Note requires at least one image. For text-only, please set contentType="article".');
      }

      if (inputImages.length > 0) {
        const tempDir = path.join(DATA_DIR, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
        for (let index = 0; index < inputImages.length; index++) {
            const imgData = inputImages[index];
            const filePath = path.join(tempDir, `upload-${Date.now()}-${index}.png`);
            try {
                let buffer: Buffer;
                if (imgData.startsWith('http')) {
                    const response = await axios.get(imgData, { responseType: 'arraybuffer' });
                    buffer = Buffer.from(response.data);
                } else if (imgData.startsWith('data:image')) {
                    const base64Data = imgData.replace(/^data:image\/\w+;base64,/, "");
                    buffer = Buffer.from(base64Data, 'base64');
                } else { continue; }
                fs.writeFileSync(filePath, buffer);
                filePaths.push(filePath);
            } catch (err) { console.error(err); }
        }
      }
  }

  try {
    // Navigate
    let TARGET_URL = Selectors.Publish.Url.Image;
    if (isVideo) TARGET_URL = Selectors.Publish.Url.Video;
    else if (isArticle) TARGET_URL = Selectors.Publish.Url.Article;

    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await takeProgressScreenshot(page, taskId!);
    await RPAUtils.humanDelay(page, 2000, 3000);

    if (page.url().includes('/login')) throw new Error('Login expired. Please re-login.');

    // Handle Article Landing Page (Click "Write Long Article" if needed)
    if (isArticle) {
        try {
            // New logic: Check if we are on the landing page based on URL parameters
            const currentUrl = page.url();
            
            // If URL contains target=article, we might need to click "New Creation" or it auto-redirects
            // But if we are on the page shown in the screenshot, we need to click "新的创作" (New Creation)
            // The screenshot shows a red button "新的创作" (New Creation)
            
            const newCreationBtn = page.locator('button:has-text("新的创作")').first();
            const writeLongArticleTab = page.locator('div:has-text("写长文")').first(); // The tab might be clickable too
            
            // Wait for potential elements
            await Promise.race([
                newCreationBtn.waitFor({ state: 'visible', timeout: 5000 }),
                page.waitForSelector(Selectors.Publish.Form.TitleInput, { timeout: 5000 })
            ]).catch(() => {});

            // If "New Creation" button is visible, click it
            if (await newCreationBtn.isVisible()) {
                Logger.info('RPA:Publish', 'Found "New Creation" button, clicking...');
                
                // Clicking this button usually opens the editor in the SAME tab for SPA, 
                // but sometimes it might open a new tab or trigger navigation.
                // Let's handle both.
                
                const newPagePromise = page.context().waitForEvent('page', { timeout: 5000 }).catch(() => null);
                await newCreationBtn.click();
                
                const newPage = await newPagePromise;
                if (newPage) {
                    Logger.info('RPA:Publish', 'New tab detected, switching context to new page.');
                    await newPage.waitForLoadState('domcontentloaded');
                    await newPage.bringToFront();
                    
                    // Reassign the page variable to the new page
                    page = newPage;
                    await RPAUtils.initPage(page); // Re-init utils for new page
                } else {
                    // Same tab navigation
                    // Wait for the URL to change to ensure navigation started
                    try {
                        await page.waitForURL((url) => url.toString().includes('target=article') === false || url.toString().includes('publish'), { timeout: 5000 });
                    } catch(e) {
                         // URL might not change if it's pure SPA or already matched, just continue
                    }
                }
            } 
            
            // Wait for editor UI to stabilize
            // Instead of just waiting for input, wait for the editor container or toolbar first
            // This prevents "Restore Page" popup from stealing focus or blocking rendering
            try {
                // Try to close "Restore Page" popup if it exists (using a generic selector strategy or key press)
                // Pressing Escape often closes modals
                await page.keyboard.press('Escape');
                
                // Wait for H1/H2 toolbar which indicates editor is loaded
                // Using text selector for H1/H2 in toolbar
                // Based on screenshot: H1, H2 icons are present
                const toolbar = page.locator('.editor-toolbar, .toolbar, div:has(> button:has-text("H1"))').first();
                await Promise.race([
                    toolbar.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
                    // Frame Awareness: The editor might be in an iframe
                    // We don't wait for selector here, we let safeType handle it with frame searching
                    page.waitForSelector(Selectors.Publish.Form.TitleInput, { timeout: 10000 }).catch(() => {})
                ]);
            } catch(e) {}
            
            // Wait for editor to load (Title Input)
            // Note: safeType now handles frame searching, so we can rely on it,
            // but we still want to wait a bit to ensure page load.
            // Let's use a loose wait or just proceed to safeType which has built-in wait.
            // However, to prevent fast failure, we wait for *something* to be ready.
            
            await RPAUtils.humanDelay(page, 1000, 2000);

            // BLIND CLICK / FALLBACK: If title input is tricky (e.g. contenteditable div with placeholder)
            // We can try to find the text "输入标题" and click it to focus
            try {
                // Wait for the editor to render
                await RPAUtils.humanDelay(page, 1000, 2000);
                
                // If standard selectors are failing, it might be due to dynamic hydration or obscure elements.
                // Let's try to click the placeholder text "输入标题" directly.
                // This mimics a user seeing the text and clicking on it.
                const titlePlaceholder = page.getByText('输入标题', { exact: true }).first();
                if (await titlePlaceholder.isVisible({ timeout: 2000 })) {
                     Logger.info('RPA:Publish', 'Found "输入标题" text, clicking to focus...');
                     await titlePlaceholder.click({ force: true });
                     // After clicking, the placeholder might disappear or the input might become active.
                     // We don't wait here, we let safeType do the typing.
                }
            } catch(e) {
                // If "输入标题" text is not found, maybe it's already focused or user typed something?
            }

        } catch (e) {
            // It's possible we are already in the editor (e.g. cookie saved state), so just proceed
            Logger.info('RPA:Publish', 'Article start button not found or timeout, assuming editor is active or trying to proceed.');
        }
    }

    // Upload Files (Skip for Article)
    if (!isArticle && filePaths.length > 0) {
        // Use generalized upload helper
        const uploadSelector = Selectors.Publish.Upload.FileInput;
        
        // Wait for input to be attached
        try {
            await page.waitForSelector(uploadSelector, { timeout: 10000, state: 'attached' });
            await RPAUtils.uploadFile(page, uploadSelector, filePaths);
            
            // Wait for processing
            if (isVideo) {
                await page.waitForTimeout(5000); // Video verification time
            } else {
                // Handle crop modal
                try {
                    const confirmBtn = page.locator(Selectors.Publish.Upload.ConfirmCrop).first();
                    await Promise.race([
                        confirmBtn.waitFor({ state: 'visible', timeout: 15000 }).then(async () => {
                            if (await confirmBtn.isVisible()) await confirmBtn.click();
                        }),
                        page.waitForSelector(Selectors.Publish.Form.TitleInput, { timeout: 15000 })
                    ]);
                } catch (e) {}
            }
            await takeProgressScreenshot(page, taskId!);
        } catch (uploadError) {
             Logger.warn('RPA:Publish', 'Upload selector not found immediately, trying fallback...');
             // Fallback for different page versions
             await page.setInputFiles('input[type="file"]', filePaths);
        }
    }

    // Handle Article Mode (3-Step Flow)
    if (isArticle) {
        // Step 1: Editor Page
        // Fill Title (Visual Title in the image)
        const titleSelector = Selectors.Publish.Article.TitleInput;
        await RPAUtils.safeType(page, titleSelector, note.title);
        
        // Fill Body Content (Visual Body)
        const contentEditor = page.locator(Selectors.Publish.Form.ContentEditor).first();
        if (await contentEditor.isVisible()) {
             await contentEditor.click();
             await page.evaluate(function(text: string) { return navigator.clipboard.writeText(text); }, note.content); // Only content here
             const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
             await page.keyboard.press(`${modifier}+V`);
        }
        await takeProgressScreenshot(page, taskId!);

        // Click "One Click Layout"
        Logger.info('RPA:Publish', 'Clicking One Click Layout...');
        await RPAUtils.safeClick(page, Selectors.Publish.Article.OneClickLayout);
        await RPAUtils.humanDelay(page, 1000, 2000);

        // Step 2: Layout Selection Page
        // Wait for "Next Step" button
        Logger.info('RPA:Publish', 'Waiting for Layout Page...');
        const nextBtn = page.locator(Selectors.Publish.Article.NextStep).first();
        await nextBtn.waitFor({ state: 'visible', timeout: 20000 });
        
        // Click "Next Step"
        Logger.info('RPA:Publish', 'Clicking Next Step...');
        await nextBtn.click();
        await RPAUtils.humanDelay(page, 1000, 2000);

        // Step 3: Final Publish Page (Similar to Image Mode)
        Logger.info('RPA:Publish', 'Arrived at Final Publish Page. Filling metadata...');
        
        // Wait for final title input
        const finalTitleSelector = Selectors.Publish.Form.TitleInputImage; // It's effectively an image post now
        await page.waitForSelector(finalTitleSelector, { state: 'visible', timeout: 20000 });
        
        // Fill Metadata Title (Actual Post Title)
        await RPAUtils.safeType(page, finalTitleSelector, note.title);
        
        // Fill Metadata Description (Tags / Caption)
        const caption = `${note.title}\n\n${note.tags.map(t => `#${t}`).join(' ')}`;
        const finalDescEditor = page.locator(Selectors.Publish.Form.ContentEditor).first();
        if (await finalDescEditor.isVisible()) {
             await finalDescEditor.click();
             // Clear existing if any (unlikely for description)
             await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+A`);
             await page.keyboard.press('Backspace');
             
             await page.evaluate(function(text: string) { return navigator.clipboard.writeText(text); }, caption);
             const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
             await page.keyboard.press(`${modifier}+V`);
        }

    } else {
        // Handle Image/Video Mode
        await RPAUtils.humanDelay(page);

        // Fill Title
        const titleSelector = Selectors.Publish.Form.TitleInputImage || Selectors.Publish.Form.TitleInput;
        
        // Extra wait for Image mode
        try {
            await page.waitForSelector(titleSelector, { state: 'visible', timeout: 10000 });
        } catch(e) {
            Logger.warn('RPA:Publish', 'Title input not visible yet. Upload might be slow or failed.');
        }

        await RPAUtils.safeType(page, titleSelector, note.title);
        
        // Fill Content
        const fullContent = `${note.content}\n\n${note.tags.map(t => `#${t}`).join(' ')}`;
        const contentEditor = page.locator(Selectors.Publish.Form.ContentEditor).first();
        if (await contentEditor.isVisible()) {
            await contentEditor.click();
            await page.evaluate(function(text: string) { return navigator.clipboard.writeText(text); }, fullContent);
            const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
            await page.keyboard.press(`${modifier}+V`);
        }
    }

    await takeProgressScreenshot(page, taskId!);

    // AI Declaration (Video Only)
    if (isVideo) {
        try {
             const declarationBtn = page.locator(Selectors.Publish.AI.DeclarationBtn).first();
             if (await declarationBtn.isVisible()) {
                 await declarationBtn.click();
                 await RPAUtils.humanDelay(page, 500, 1000);
                 await RPAUtils.safeClick(page, Selectors.Publish.AI.Option);
                 await page.mouse.click(10, 10); // Close popup
             }
        } catch (e) {
             Logger.warn('RPA:Publish', 'Failed to set AI Declaration', e);
        }
    }
    
    // Auto Publish
    if (note.autoPublish) {
        const publishBtnSelector = Selectors.Publish.Form.PublishButton;
        // More robust selector matching "发布" with optional whitespace
        const publishBtn = page.locator(publishBtnSelector).filter({ hasText: /^\s*发布\s*$/ }).first();
        
        try {
            await publishBtn.waitFor({ state: 'visible', timeout: 60000 });
            await takeProgressScreenshot(page, taskId!);
            
            // Wait if disabled
            if (await publishBtn.isDisabled()) {
                Logger.info('RPA:Publish', 'Publish button disabled, waiting...');
                const start = Date.now();
                while (await publishBtn.isDisabled()) {
                    if (Date.now() - start > 60000) break;
                    await page.waitForTimeout(1000);
                }
            }

            // Use safe click with human movement
            Logger.info('RPA:Publish', 'Clicking publish button...');
            await publishBtn.click({ force: true });
            
        } catch (e: any) {
            Logger.error('RPA:Publish', 'Failed to click publish button', e);
            // Handle context closed error specifically
            if (e.message.includes('Target page, context or browser has been closed')) {
                 throw new Error('Browser closed unexpectedly before clicking publish.');
            }
             // Last ditch
             try {
                await page.locator('button:has-text("发布")').last().click({ force: true });
             } catch(lastError) {
                 Logger.error('RPA:Publish', 'Last ditch click failed', lastError);
             }
        }
        
        // Confirm Success
        try {
             await Promise.race([
                 page.waitForSelector(Selectors.Publish.Form.SuccessIndicator, { timeout: 15000 }), 
                 page.waitForURL('**/success', { timeout: 15000 }),
                 page.waitForFunction(function() {
                     const text = document.body.innerText;
                     return text.includes('发布成功') || text.includes('笔记已发布');
                 }, { timeout: 15000 })
             ]);
             Logger.info('RPA:Publish', 'Publish success confirmed by UI.');
             
             // Attempt to extract Note ID / URL
             // Priority: 1. Network Interception (Most Reliable) 2. URL 3. UI Buttons
             let noteId = capturedNoteId;
             let noteUrl = capturedNoteUrl;

             if (!noteId) {
                 try {
                     // 1. Check if URL already contains it (rare for creation)
                     const currentUrl = page.url();
                     const idMatch = currentUrl.match(/\/explore\/([a-zA-Z0-9]+)/);
                     if (idMatch) {
                         noteId = idMatch[1];
                         noteUrl = currentUrl;
                     } else {
                         // 2. Look for "View Note" button
                         const viewBtn = page.locator('a:has-text("查看笔记"), button:has-text("查看笔记")').first();
                         if (await viewBtn.isVisible({ timeout: 3000 })) {
                             const href = await viewBtn.getAttribute('href');
                             if (href) {
                                 noteUrl = href.startsWith('http') ? href : `https://www.xiaohongshu.com${href}`;
                                 const match = noteUrl.match(/\/explore\/([a-zA-Z0-9]+)/);
                                 if (match) noteId = match[1];
                             }
                         }
                     }
                 } catch (captureErr) {
                     Logger.warn('RPA:Publish', 'Failed to capture Note ID via UI fallback', captureErr);
                 }
             }

             if (noteId) Logger.info('RPA:Publish', `Final Note ID: ${noteId}`);

             // Do not close the entire browser context as it might be shared with other tasks
             // Just close the page to clean up this specific task
             // setTimeout(() => { try { page.close(); } catch(e) {} }, 3000); // Removed unsafe timeout
             await takeProgressScreenshot(page, taskId!);
             
             return { success: true, noteId, noteUrl };
        } catch (e: any) {
             if (e.message && e.message.includes('Target page, context or browser has been closed')) {
                 Logger.warn('RPA:Publish', 'Browser closed during confirmation wait. Assuming success if no previous errors.');
                 return { success: true, warning: 'Browser closed early' };
             }
             Logger.warn('RPA:Publish', 'Publish confirmation not detected. Browser kept open.');
             try { await Logger.saveScreenshot(page, 'publish-no-confirmation'); } catch(e) {}
             await takeProgressScreenshot(page, taskId!);
             return { success: true, warning: 'Published but confirmation not detected' };
        }
    } else {
        Logger.info('RPA:Publish', 'Manual mode. Browser left open.');
        await takeProgressScreenshot(page, taskId!);
    }

    return { success: true };
  } catch (e: any) { 
      Logger.error('RPA:Publish', `Publish failed: ${e.message}`, e);
      if (page) {
          await Logger.saveScreenshot(page, 'publish-failed');
          await takeProgressScreenshot(page, taskId!);
      }
      throw e; 
  } finally {
      if (page) {
          try { await page.close(); } catch(e) {}
      }
  }
}
