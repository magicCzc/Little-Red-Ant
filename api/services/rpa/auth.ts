
import { Browser } from 'playwright';
import db from '../../db.js';
import { launchBrowser, createBrowserContext } from './utils.js';
import { Logger } from '../LoggerService.js';
import axios from 'axios';
import { Selectors } from './config/selectors.js';
import { EncryptionService } from '../core/EncryptionService.js';
import { BrowserService } from './BrowserService.js';

// Login State Management
let loginState: {
  status: 'IDLE' | 'WAITING_FOR_SCAN' | 'SUCCESS' | 'FAILED';
  type?: 'CREATOR' | 'MAIN_SITE';
  message?: string;
} = { status: 'IDLE' };

export function getLoginState() {
  return loginState;
}

export async function checkAllAccountsHealth() {
    Logger.info('Auth', 'Starting daily account health check...');
    const accounts = db.prepare('SELECT id, nickname, creator_cookies, main_site_cookies FROM accounts WHERE is_active = 1 OR creator_cookies IS NOT NULL OR main_site_cookies IS NOT NULL').all() as any[];
    
    for (const acc of accounts) {
        Logger.info('Auth', `Checking account: ${acc.nickname || acc.id}`);
        // Use BrowserService for health check instead of raw launch
        const session = await BrowserService.getInstance().getAuthenticatedPage('ANONYMOUS', true); // Headless
        const { browser, page } = session;

        try {
            // 1. Check Creator Cookies
            if (acc.creator_cookies) {
                Logger.info('Auth', `Checking Creator cookies for: ${acc.nickname || acc.id}`);
                const decryptedCookies = EncryptionService.decrypt(acc.creator_cookies);
                const cookies = JSON.parse(decryptedCookies);
                
                // Add cookies to current context
                if (cookies.cookies) await session.context.addCookies(cookies.cookies);
                else if (Array.isArray(cookies)) await session.context.addCookies(cookies);
                
                try {
                    await page.goto('https://creator.xiaohongshu.com/creator/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForTimeout(3000); // Wait for potential redirect
                    
                    // Check if redirected to login
                    if (page.url().includes('/login')) {
                        Logger.warn('Auth', `Creator Cookie Expired: ${acc.nickname || acc.id}`);
                        db.prepare("UPDATE accounts SET creator_cookies = NULL WHERE id = ?").run(acc.id);
                    } else {
                        // Double check if we are really logged in
                        const isLoggedIn = await page.evaluate((selectors: any) => {
                            return !!document.querySelector(selectors.Common.Login.LoggedInIndicators.Creator);
                        }, Selectors);
                        
                        if (isLoggedIn) {
                            Logger.info('Auth', `Creator Cookie Valid: ${acc.nickname || acc.id}`);
                        } else {
                            Logger.warn('Auth', `Creator Cookie Suspicious: ${acc.nickname || acc.id}`);
                            db.prepare("UPDATE accounts SET creator_cookies = NULL WHERE id = ?").run(acc.id);
                        }
                    }
                } catch (e: any) {
                    Logger.error('Auth', `Creator check failed: ${e.message}`);
                }
                // Do not close context, just clear cookies for next check if needed, but we use new page anyway
                await session.context.clearCookies();
            }

            // 2. Check Main Site Cookies
            if (acc.main_site_cookies) {
                Logger.info('Auth', `Checking Main Site cookies for: ${acc.nickname || acc.id}`);
                const decryptedCookies = EncryptionService.decrypt(acc.main_site_cookies);
                const cookies = JSON.parse(decryptedCookies);
                
                if (cookies.cookies) await session.context.addCookies(cookies.cookies);
                else if (Array.isArray(cookies)) await session.context.addCookies(cookies);
                
                try {
                    await page.goto('https://www.xiaohongshu.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForTimeout(3000);
                    
                    const isLoggedOut = await page.evaluate(function(selectors: any) {
                        return !!document.querySelector(selectors.Common.Login.LoggedOutIndicators.MainSite);
                    }, Selectors);
                    
                    const isLoggedIn = await page.evaluate(function(selectors: any) {
                        return !!document.querySelector(selectors.Common.Login.LoggedInIndicators.MainSite);
                    }, Selectors);

                    if (isLoggedOut || !isLoggedIn) {
                        Logger.warn('Auth', `Main Site Cookie Expired: ${acc.nickname || acc.id}`);
                        db.prepare("UPDATE accounts SET main_site_cookies = NULL WHERE id = ?").run(acc.id);
                    } else {
                        Logger.info('Auth', `Main Site Cookie Valid: ${acc.nickname || acc.id}`);
                    }
                } catch (e: any) {
                     Logger.error('Auth', `Main Site check failed: ${e.message}`);
                }
                 await session.context.clearCookies();
            }

            // 3. Update Overall Status
            // Re-fetch to get latest status
            const updatedAcc = db.prepare('SELECT creator_cookies, main_site_cookies FROM accounts WHERE id = ?').get(acc.id) as any;
            if (!updatedAcc.creator_cookies && !updatedAcc.main_site_cookies) {
                db.prepare("UPDATE accounts SET status = 'EXPIRED' WHERE id = ?").run(acc.id);
            } else {
                db.prepare("UPDATE accounts SET status = 'ACTIVE' WHERE id = ?").run(acc.id);
            }

        } catch (e: any) {
            Logger.error('Auth', `Health check error for ${acc.nickname || acc.id}`, e);
        } finally {
             // Close only page
             if (page) { try { await page.close(); } catch(e) {} }
        }
    }
    Logger.info('Auth', 'Daily account health check completed.');
}

// --- CREATOR LOGIN (For Publishing & Stats) ---
export async function startCreatorLogin(accountId?: number): Promise<void> {
  if (loginState.status === 'WAITING_FOR_SCAN') return;

  loginState = { status: 'WAITING_FOR_SCAN', type: 'CREATOR' };
  
  let browser: Browser | null = null;
  try {
    browser = await launchBrowser(false);
    const context = await createBrowserContext(browser);
    const page = await context.newPage();
    
    console.log('Navigating to Xiaohongshu Creator Center login...');
    await page.goto('https://creator.xiaohongshu.com/publish/publish', { waitUntil: 'domcontentloaded' });
    
    // Check loop: 5 minutes
    for (let i = 0; i < 150; i++) {
      if (loginState.status === 'FAILED') break;

      const currentUrl = page.url();
      const isOnLoginPage = currentUrl.includes('/login');
      const isCreatorPage = currentUrl.includes('creator.xiaohongshu.com');
      
      if (i % 5 === 0) console.log(`[Creator Login] URL: ${currentUrl}`);

      if (isCreatorPage && !isOnLoginPage) {
        // [Optimized] Wait for UI
        try {
            await page.waitForSelector(Selectors.Common.Login.LoggedInIndicators.Creator, { timeout: 5000 }).catch(() => {});
        } catch(e) {}

        const isLoggedIn = await page.evaluate(function(selectors: any) {
            return !!document.querySelector(selectors.Common.Login.LoggedInIndicators.Creator);
        }, Selectors);

        if (isLoggedIn) {
            console.log('Creator Center Login verified!');
            const storageState = await context.storageState();
            const storageStr = JSON.stringify(storageState);
            const encryptedCookies = EncryptionService.encrypt(storageStr);
            
            let nickname = `账号-${Date.now().toString().slice(-4)}`;
            let avatar = '';

            try {
               const info = await page.evaluate(function(selectors: any) {
                   const clean = function(str: string) { return str ? str.trim() : ''; };
                   
                   // Strategy 1: Specific selectors
                   let name = document.querySelector(selectors.Common.UserInfo.Name)?.textContent;
                   let imgSrc = document.querySelector(selectors.Common.UserInfo.Avatar)?.getAttribute('src');

                   return { name: clean(name || ''), avatar: imgSrc || '' };
               }, Selectors);

               if (info.name) nickname = info.name;
               if (info.avatar) avatar = info.avatar;
               
               console.log(`[Auth] Captured user info: ${nickname}, avatar: ${avatar ? 'Found' : 'Missing'}`);

            } catch (e) {
                console.error('[Auth] Failed to scrape user info:', e);
            }

            if (accountId) {
                db.prepare('UPDATE accounts SET creator_cookies = ?, nickname = ?, avatar = ?, last_used_at = CURRENT_TIMESTAMP WHERE id = ?')
                  .run(encryptedCookies, nickname, avatar, accountId);
            } else {
                db.prepare('UPDATE accounts SET is_active = 0').run();
                db.prepare(`
                    INSERT INTO accounts (nickname, avatar, creator_cookies, is_active, last_used_at)
                    VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
                `).run(nickname, avatar, encryptedCookies);
            }

            loginState = { status: 'SUCCESS', message: 'Creator Login successful', type: 'CREATOR' };
            await page.waitForTimeout(2000); 
            await browser.close();
            return;
        }
      }
      await page.waitForTimeout(2000);
    }
    
    loginState = { status: 'FAILED', message: 'Login timeout', type: 'CREATOR' };
    await browser.close();

  } catch (error: any) {
    console.error('Creator Login failed:', error);
    loginState = { status: 'FAILED', message: error.message, type: 'CREATOR' };
    if (browser) await browser.close();
  }
}

// --- MAIN SITE LOGIN (For Viewing) ---
export async function startMainSiteLogin(accountId: number): Promise<void> {
  if (loginState.status === 'WAITING_FOR_SCAN') return;

  loginState = { status: 'WAITING_FOR_SCAN', type: 'MAIN_SITE' };
  
  let browser: Browser | null = null;
  try {
    browser = await launchBrowser(false);
    const context = await createBrowserContext(browser);
    const page = await context.newPage();
    
    console.log('Navigating to Xiaohongshu Main Site login...');
    await page.goto('https://www.xiaohongshu.com', { waitUntil: 'domcontentloaded' });
    
    for (let i = 0; i < 150; i++) {
      if (loginState.status === 'FAILED') break;

      const isLoggedIn = await page.evaluate(function(selectors: any) {
          // Negative Check
          const loggedOut = document.querySelector(selectors.Common.Login.LoggedOutIndicators.MainSite);
          if (loggedOut) return false;

          // Positive Check
          return !!document.querySelector(selectors.Common.Login.LoggedInIndicators.MainSite);
      }, Selectors);

      if (isLoggedIn) {
          console.log('Main Site Login verified!');
          const storageState = await context.storageState();
          const storageStr = JSON.stringify(storageState);
          
          db.prepare('UPDATE accounts SET main_site_cookies = ?, last_used_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(storageStr, accountId);

          loginState = { status: 'SUCCESS', message: 'Main Site Login successful', type: 'MAIN_SITE' };
          await page.waitForTimeout(2000); 
          await browser.close();
          return;
      }
      await page.waitForTimeout(2000);
    }
    
    loginState = { status: 'FAILED', message: 'Login timeout', type: 'MAIN_SITE' };
    await browser.close();
  } catch (error: any) {
    console.error('Main Site Login failed:', error);
    loginState = { status: 'FAILED', message: error.message, type: 'MAIN_SITE' };
    if (browser) await browser.close();
  }
}

export function getCookies(type: 'CREATOR' | 'MAIN_SITE', accountId?: number) {
    let account;
    if (accountId) {
        account = db.prepare('SELECT creator_cookies, main_site_cookies, cookies FROM accounts WHERE id = ?').get(accountId) as any;
    } else {
        account = db.prepare('SELECT creator_cookies, main_site_cookies, cookies FROM accounts WHERE is_active = 1').get() as any;
    }
    
    if (!account) {
        if (accountId) throw new Error(`Account ${accountId} not found`);
        throw new Error('No active account');
    }

    if (type === 'CREATOR') {
        const cookieStr = account.creator_cookies || account.cookies;
        if (cookieStr) {
            const decrypted = EncryptionService.decrypt(cookieStr);
            const parsed = JSON.parse(decrypted);
            // Handle Playwright Storage State format { cookies: [...], origins: [...] }
            if (parsed.cookies && Array.isArray(parsed.cookies)) {
                return parsed.cookies;
            }
            // Handle raw array format
            if (Array.isArray(parsed)) {
                return parsed;
            }
            return null;
        }
    } else {
        if (account.main_site_cookies) {
            const parsed = JSON.parse(account.main_site_cookies);
            if (parsed.cookies && Array.isArray(parsed.cookies)) return parsed.cookies;
            if (Array.isArray(parsed)) return parsed;
            return null;
        }
    }
    return null;
}

/**
 * Lightweight verification of session validity using a simple HTTP request.
 * This avoids the overhead of launching a full browser.
 */
export async function verifySessionWithRequest(accountId?: number): Promise<boolean> {
    try {
        const cookies = getCookies('CREATOR', accountId);
        if (!cookies) return false;

        // Convert Playwright cookies to Header string
        const cookieHeader = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');

        // Ping a lightweight endpoint
        // 'https://creator.xiaohongshu.com/api/creator/user/info' is a good candidate
        const res = await axios.get('https://creator.xiaohongshu.com/api/creator/user/info', {
            headers: {
                'Cookie': cookieHeader,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://creator.xiaohongshu.com/creator/home',
                'Accept': 'application/json, text/plain, */*'
            },
            validateStatus: (status) => status < 500, // Don't throw on 4xx so we can handle it
            maxRedirects: 0 // CRITICAL: Do not follow redirects to login page
        });

        if (res.status === 200 && res.data && res.data.code === 0) {
            return true;
        }
        
        console.warn(`[Auth] Session verification failed for account ${accountId || 'Active'}. Status: ${res.status}, Code: ${res.data?.code}, Content-Type: ${res.headers['content-type']}`);
        return false;

    } catch (e: any) {
        // 302 Redirects will throw in axios if maxRedirects: 0
        if (e.response && (e.response.status === 301 || e.response.status === 302)) {
             console.warn(`[Auth] Session verification failed: Redirected (Cookie Expired). Account: ${accountId || 'Active'}`);
             return false;
        }

        console.error(`[Auth] Session verification error for account ${accountId || 'Active'}:`, e.message);
        return false;
    }
}
