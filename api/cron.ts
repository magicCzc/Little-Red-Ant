
import cron from 'node-cron';
import { Logger } from './services/LoggerService.js';
import { ComplianceService } from './services/core/ComplianceService.js';
import { recoverStaleTasks } from './services/queue.js';

const RECOVERY_SCHEDULE = '*/10 * * * *';

// Initialize Cron Jobs
export function initCron() {
    Logger.info('Cron', 'Initializing cron jobs...');

    // 0. Task Recovery Job (High Priority)
    cron.schedule(RECOVERY_SCHEDULE, () => {
        // Logger.debug('Cron', 'Checking for stale tasks...');
        recoverStaleTasks();
    });

    // 1. Sync Compliance Rules (Daily at 03:00 AM)
    // "0 3 * * *" = At 03:00.
    cron.schedule('0 3 * * *', async () => {
        Logger.info('Cron', 'Running scheduled compliance rules sync...');
        try {
            await ComplianceService.syncRules();
        } catch (e: any) {
            Logger.error('Cron', `Compliance rules sync failed: ${e.message}`);
        }
    });

    Logger.info('Cron', 'Cron jobs scheduled.');
}
