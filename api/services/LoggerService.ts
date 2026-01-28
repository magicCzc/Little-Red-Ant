import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[Logger] __dirname:', __dirname);
const logsDir = path.join(__dirname, '../../logs');
console.log('[Logger] logsDir:', logsDir);

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const screenshotsDir = path.join(logsDir, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

export class Logger {
    static info(module: string, message: string, meta?: any) {
        this.log('INFO', module, message, meta);
    }

    static error(module: string, message: string, error?: any) {
        this.log('ERROR', module, message, error);
    }

    static warn(module: string, message: string, meta?: any) {
        this.log('WARN', module, message, meta);
    }

    private static log(level: string, module: string, message: string, meta?: any) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] [${module}] ${message} ${meta ? JSON.stringify(meta) : ''}\n`;
        
        // Console output
        if (level === 'ERROR') {
            console.error(logEntry.trim());
        } else {
            console.log(logEntry.trim());
        }

        // File output (Daily Rotate)
        const dateStr = new Date().toISOString().split('T')[0];
        const logFile = path.join(logsDir, `app-${dateStr}.log`);
        
        fs.appendFile(logFile, logEntry, (err) => {
            if (err) console.error('Failed to write log:', err);
        });
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
