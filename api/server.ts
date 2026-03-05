/**
 * local server entry file, for local development
 * Updated: 2026-01-26
 */
import app from './app.js';
import { initCronJobs } from './services/cron.js';
import { initCron as initSystemCron } from './cron.js';
import { startWorker } from './worker.js';
import { BrowserService } from './services/rpa/BrowserService.js';
import { ComplianceService } from './services/core/ComplianceService.js';
import db from './db.js';

// Global Error Boundary
process.on('uncaughtException', (error) => {
    console.error('[FATAL] Uncaught Exception:', error);
    // Log to file via LoggerService if possible, but keep process alive for now
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

// Initialize Cron Jobs
initCronJobs();
initSystemCron();

// Start-up Compliance Sync (Non-blocking)
// Wait 5s to let server start first
// setTimeout(() => {
//     console.log('[System] Triggering startup compliance rules sync...');
//     ComplianceService.syncRules().catch(e => console.error('[System] Startup sync failed:', e));
// }, 5000);

// Recovery: Reset tasks that were stuck in PROCESSING state due to server restart
try {
    const result = db.prepare("UPDATE tasks SET status = 'PENDING', attempts = attempts + 1, error = 'Recovered from server restart' WHERE status = 'PROCESSING'").run();
    if (result.changes > 0) {
        console.log(`[System] Recovered ${result.changes} stuck tasks (reset to PENDING).`);
    }
} catch (e) {
    console.error('[System] Failed to recover stuck tasks:', e);
}

// Initialize Task Worker
startWorker();

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
});

/**
 * Graceful Shutdown Handler
 */
const gracefulShutdown = async (signal: string) => {
  console.log(`\n[${signal}] Signal received. Starting graceful shutdown...`);
  
  // 1. Close Server
  server.close(() => {
    console.log('HTTP Server closed.');
  });

  // 2. Close Browsers (Critical for RPA)
  try {
    console.log('Closing browser instances...');
    await BrowserService.getInstance().closeAll();
  } catch (e) {
    console.error('Error closing browsers:', e);
  }

  // 3. Close Database
  try {
    console.log('Closing database connection...');
    db.close();
    console.log('Database connection closed.');
  } catch (e) {
    console.error('Error closing database:', e);
  }

  console.log('Graceful shutdown completed. Exiting.');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;