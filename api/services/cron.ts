
import cron from 'node-cron';
import { scrapeNoteStats, getLoginState } from './rpa/xiaohongshu.js';
import { checkAllAccountsHealth } from './rpa/auth.js';
import { scrapeComments } from './rpa/comments.js';
import { Logger } from './LoggerService.js';
import { SettingsService } from './SettingsService.js';

// Configuration
// Default: Every 6 hours (at minute 0)
// Cron syntax: 0 */6 * * *
// 0 9,15,21,3 * * * -> 9am, 3pm, 9pm, 3am
const DEFAULT_SYNC_SCHEDULE = '0 9,15,21,3 * * *'; 
const HEALTH_CHECK_SCHEDULE = '0 2 * * *'; // 2:00 AM Daily
const TRENDS_SCRAPE_SCHEDULE = '0 */3 * * *'; // Every 3 hours
const COMPETITOR_SYNC_SCHEDULE = '0 10 * * *'; // 10:00 AM Daily

let isJobRunning = false;
let syncTask: any = null;

export async function initCronJobs() {
    // Load Schedule from Settings
    let syncSchedule = await SettingsService.get('SYNC_SCHEDULE');
    if (!syncSchedule) {
        syncSchedule = DEFAULT_SYNC_SCHEDULE;
        await SettingsService.set('SYNC_SCHEDULE', syncSchedule, 'Cron expression for data sync');
    }

    Logger.info('Cron', `Initializing background jobs... Sync: ${syncSchedule}, Health: ${HEALTH_CHECK_SCHEDULE}, Trends: ${TRENDS_SCRAPE_SCHEDULE}, Competitor: ${COMPETITOR_SYNC_SCHEDULE}`);

    // 1. Data Sync Job (Account Stats)
    startSyncJob(syncSchedule);

    // 2. Account Health Check Job
    cron.schedule(HEALTH_CHECK_SCHEDULE, async () => {
        Logger.info('Cron', 'Triggering daily account health check...');
        await checkAllAccountsHealth();
    });
    
    // 3. Trending Notes Scrape (Every 3 hours)
    cron.schedule(TRENDS_SCRAPE_SCHEDULE, async () => {
        // Safety Check: Night Mode
        const hour = new Date().getHours();
        if (hour >= 2 && hour < 6) {
             Logger.info('Cron', 'Night Mode active (2am-6am). Skipping trends scrape.');
             return;
        }

        Logger.info('Cron', 'Triggering scheduled trending notes scrape...');
        try {
            const { enqueueTask } = await import('./queue.js');
            const categories = [
                'recommend', 'video', 'fashion', 'beauty', 'food', 'home', 'travel', 'tech', 'career',
                'emotion', 'baby', 'movie', 'knowledge', 'game', 'fitness', 'pets', 'photography', 
                'art', 'music', 'books', 'automobile', 'wedding', 'outdoors', 'acg', 'sports', 'news'
            ];
            
            // Stagger them slightly to avoid massive spike
            for (const [index, category] of categories.entries()) {
                setTimeout(() => {
                    Logger.info('Cron', `Queuing trends scrape for ${category}`);
                    enqueueTask('SCRAPE_TRENDS', { source: 'xiaohongshu', category });
                }, index * 60 * 1000); // 1 minute apart
            }
        } catch (e) {
            Logger.error('Cron', 'Failed to schedule trends scrape', e);
        }
    });

    // 4. Daily Competitor Monitor Sync
    cron.schedule(COMPETITOR_SYNC_SCHEDULE, async () => {
        Logger.info('Cron', 'Triggering daily competitor monitor sync...');
        try {
            const { enqueueTask } = await import('./queue.js');
            const db = (await import('../db.js')).default;
            
            const competitors = db.prepare("SELECT id, user_id, nickname FROM competitors WHERE status != 'error'").all() as any[];
            
            if (competitors.length === 0) {
                Logger.info('Cron', 'No active competitors to sync.');
                return;
            }

            Logger.info('Cron', `Found ${competitors.length} competitors to sync. Scheduling tasks...`);

            // Stagger tasks: 1 every 2-5 minutes to be safe
            for (const [index, comp] of competitors.entries()) {
                const delay = (index * 3 * 60 * 1000) + Math.floor(Math.random() * 60000); // 3 mins base + random jitter
                
                setTimeout(() => {
                    Logger.info('Cron', `Queuing competitor scrape for ${comp.nickname} (${comp.user_id})`);
                    // Set 'is_background' flag to true if the handler supports it (optional)
                    enqueueTask('SCRAPE_COMPETITOR', { url: comp.user_id, id: comp.id });
                }, delay);
            }

        } catch (e: any) {
            Logger.error('Cron', 'Failed to schedule competitor sync', e);
        }
    });
}

export function startSyncJob(schedule: string) {
    if (syncTask) {
        syncTask.stop();
    }
    
    syncTask = cron.schedule(schedule, async () => {
        Logger.info('Cron', 'Triggering scheduled data sync...');
        
        // 1. Check if already running
        if (isJobRunning) {
            Logger.warn('Cron', 'Job skipped: Previous job still running.');
            return;
        }

        // 2. Check if login process is active
        const loginState = getLoginState();
        if (loginState.status === 'WAITING_FOR_SCAN') {
            Logger.warn('Cron', 'Job skipped: Login process is active.');
            return;
        }

        // 3. Add random delay (1-10 minutes) to avoid robotic patterns
        const delayMs = Math.floor(Math.random() * 10 * 60 * 1000); 
        Logger.info('Cron', `Waiting ${Math.round(delayMs / 1000)}s before execution (Anti-bot delay)...`);
        
        setTimeout(async () => {
            await executeSync();
        }, delayMs);
    });
}

// Night Mode: Check if current time is within sleep window (2am - 6am)
function isNightMode() {
    const hour = new Date().getHours();
    return hour >= 2 && hour < 6;
}

async function executeSync() {
    // Safety Check: Night Mode
    if (isNightMode()) {
        Logger.info('Cron', 'Night Mode active (2am-6am). Skipping data sync to protect account safety.');
        isJobRunning = false;
        return;
    }

    try {
        isJobRunning = true;
        Logger.info('Cron', 'Starting sync execution...');
        
        // 1. Sync Note Stats (Views, Likes)
        const statsResult = await scrapeNoteStats();
        Logger.info('Cron', `Stats sync completed. Processed ${statsResult.count} notes.`);

        // 1.1 Trigger AI Feedback Loop (Link & Analyze)
        try {
            // Logger.info('Cron', 'Triggering AI Feedback Loop...');
            // await FeedbackLoopService.runCycle(); // TODO: Implement FeedbackLoopService
        } catch (fbError: any) {
            Logger.error('Cron', `Feedback Loop failed: ${fbError.message}`);
        }

        // 2. Sync Comments (Interactions)
        // Add a small delay between tasks
        await new Promise(r => setTimeout(r, 10000));
        try {
            const commentResult = await scrapeComments();
            // scrapeComments returns { success: true, count: number }
            if ('count' in commentResult) {
                Logger.info('Cron', `Comment sync completed. Found ${commentResult.count} comments.`);
            }
        } catch (commentError: any) {
            Logger.warn('Cron', `Comment sync failed (non-critical): ${commentError.message}`);
        }

    } catch (error: any) {
        Logger.error('Cron', 'Sync failed:', error);
    } finally {
        isJobRunning = false;
    }
}
