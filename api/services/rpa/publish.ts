
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

export async function openPublishPageWithContent(note: { 
    title: string, content: string, tags: string[], imageData?: string[], videoPath?: string, autoPublish?: boolean, accountId?: number, contentType?: string 
}, taskId?: string) {
  // Use BrowserService for unified session management
  const session = await BrowserService.getInstance().getAuthenticatedPage('CREATOR', false, note.accountId);
  const { browser, page } = session;
  
  // Inject polyfills for environment compatibility
  await RPAUtils.initPage(page);

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
            // Check if we are on the landing page (look for the big "Write Long Article" button)
            const startBtn = page.locator(Selectors.Publish.Article.StartBtn).first();
            // We use a short timeout because if it's already the editor, we don't want to wait long
            if (await startBtn.isVisible({ timeout: 5000 })) {
                Logger.info('RPA:Publish', 'Found Article Landing Page, clicking start button...');
                await startBtn.click();
                // Wait for transition to editor
                await page.waitForSelector(Selectors.Publish.Form.TitleInput, { timeout: 15000 });
                await RPAUtils.humanDelay(page, 1000, 2000);
            }
        } catch (e) {
            // It's possible we are already in the editor (e.g. cookie saved state), so just proceed
            Logger.info('RPA:Publish', 'Article start button not found or timeout, assuming editor is active.');
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

    await RPAUtils.humanDelay(page);

    // Fill Title
    await RPAUtils.safeType(page, Selectors.Publish.Form.TitleInput, note.title);
    
    // Fill Content
    const fullContent = `${note.content}\n\n${note.tags.map(t => `#${t}`).join(' ')}`;
    // Use clipboard paste for content (faster/safer for emojis)
    const contentEditor = page.locator(Selectors.Publish.Form.ContentEditor).first();
    if (await contentEditor.isVisible()) {
        await contentEditor.click();
        await page.evaluate(function(text: string) { return navigator.clipboard.writeText(text); }, fullContent);
        const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
        await page.keyboard.press(`${modifier}+V`);
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
            
        } catch (e) {
            Logger.error('RPA:Publish', 'Failed to click publish button', e);
             // Last ditch
             await page.locator('button:has-text("发布")').last().click({ force: true });
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
             
             setTimeout(() => { try { browser.close(); } catch(e) {} }, 3000);
             await takeProgressScreenshot(page, taskId!);
        } catch (e) {
             Logger.warn('RPA:Publish', 'Publish confirmation not detected. Browser kept open.');
             await Logger.saveScreenshot(page, 'publish-no-confirmation');
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
  }
}
