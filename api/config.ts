import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load env vars
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define Project Root
// api/config.ts -> api -> root (assuming api is at the root of the server logic, but actual project root is one level up from api)
// Structure seems to be: e:\小红蚁\api\config.ts. So root is e:\小红蚁
const PROJECT_ROOT = path.resolve(__dirname, '..'); 

// Ensure directories exist
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const TEMP_DIR = path.join(PUBLIC_DIR, 'temp');

[DATA_DIR, LOGS_DIR, PUBLIC_DIR, UPLOADS_DIR, TEMP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch (e) {
            console.error(`[Config] Failed to create directory: ${dir}`, e);
        }
    }
});

export const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    
    paths: {
        root: PROJECT_ROOT,
        data: DATA_DIR,
        logs: LOGS_DIR,
        public: PUBLIC_DIR,
        uploads: UPLOADS_DIR,
        temp: TEMP_DIR,
        db: path.join(DATA_DIR, 'app.db'),
    },

    security: {
        jwtSecret: process.env.JWT_SECRET || (() => {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('JWT_SECRET is required in production environment');
            }
            console.warn('[Security] Using default JWT secret. This is unsafe for production.');
            return 'little-red-ant-secret-key-2026-dev-only';
        })(),
        jwtExpiresIn: '7d',
    },

    ai: {
        deepseek: {
            apiKey: process.env.DEEPSEEK_API_KEY,
            baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        },
        aliyun: {
            accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
            accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
            ossBucket: process.env.ALIYUN_OSS_BUCKET,
            ossRegion: process.env.ALIYUN_OSS_REGION,
            dashscopeApiKey: process.env.DASHSCOPE_API_KEY,
        }
    },

    logging: {
        level: process.env.LOG_LEVEL || 'info', // debug, info, warn, error
        dir: LOGS_DIR,
    }
};

export default config;
