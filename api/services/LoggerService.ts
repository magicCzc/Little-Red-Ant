import fs from 'fs';
import path from 'path';
import config from '../config.js';
import winston from 'winston';
import 'winston-daily-rotate-file';

const logsDir = config.paths.logs;
const screenshotsDir = path.join(logsDir, 'screenshots');

// Ensure directories exist
if (!fs.existsSync(logsDir)) {
    try { fs.mkdirSync(logsDir, { recursive: true }); } catch (e) {}
}
if (!fs.existsSync(screenshotsDir)) {
    try { fs.mkdirSync(screenshotsDir, { recursive: true }); } catch (e) {}
}

// Configure Winston with Daily Rotate
const transport = new winston.transports.DailyRotateFile({
    filename: path.join(logsDir, 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d' // Keep 2 weeks of logs
});

const logger = winston.createLogger({
    level: config.logging.level || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, module, meta }) => {
            const metaStr = meta ? (meta instanceof Error ? meta.stack : JSON.stringify(meta)) : '';
            return `[${timestamp}] [${level.toUpperCase()}] [${module || 'App'}] ${message} ${metaStr}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        transport
    ]
});

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export class Logger {
    static info(module: string, message: string, meta?: any) {
        logger.info(message, { module, meta });
    }

    static error(module: string, message: string, error?: any) {
        logger.error(message, { module, meta: error });
    }

    static warn(module: string, message: string, meta?: any) {
        logger.warn(message, { module, meta });
    }

    static debug(module: string, message: string, meta?: any) {
        logger.debug(message, { module, meta });
    }

    static async saveScreenshot(page: any, name: string): Promise<string> {
        try {
            const timestamp = Date.now();
            const filename = `${name}-${timestamp}.png`;
            const filepath = path.join(screenshotsDir, filename);
            
            await page.screenshot({ path: filepath, fullPage: true });
            
            this.info('Logger', `Screenshot saved: ${filename}`);
            return filepath;
        } catch (e) {
            this.error('Logger', 'Failed to save screenshot', e);
            return '';
        }
    }
}
