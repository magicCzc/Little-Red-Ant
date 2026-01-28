import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import db from '../../db.js';

export interface Asset {
    id: string;
    type: 'audio' | 'image' | 'video';
    filename: string;
    url: string;
    size: number;
    created_at: string;
}

// Ensure upload directory exists
const UPLOAD_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'assets');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = randomUUID();
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
    }
});

export const upload = multer({ 
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export class AssetService {
    
    static saveAssetRecord(file: Express.Multer.File, type: 'audio' | 'image' | 'video'): Asset {
        const id = randomUUID();
        const url = `/uploads/assets/${file.filename}`;
        
        db.prepare(`
            INSERT INTO assets (id, type, filename, url, size, mime_type)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, type, file.originalname, url, file.size, file.mimetype);

        return this.getAsset(id)!;
    }

    static getAsset(id: string): Asset | undefined {
        return db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as Asset;
    }

    static listAssets(type?: string): Asset[] {
        if (type) {
            return db.prepare('SELECT * FROM assets WHERE type = ? ORDER BY created_at DESC').all(type) as Asset[];
        }
        return db.prepare('SELECT * FROM assets ORDER BY created_at DESC').all() as Asset[];
    }

    /**
     * Download an external image URL to local storage and return the local URL
     */
    static async downloadAndLocalize(externalUrl: string, type: 'image' | 'video' = 'image'): Promise<string> {
        // 1. Check if already local
        if (externalUrl.startsWith('/uploads/') || externalUrl.startsWith('http://localhost')) {
            return externalUrl;
        }

        try {
            const fetch = (await import('node-fetch')).default;
            const res = await fetch(externalUrl);
            if (!res.ok) throw new Error(`Failed to fetch ${externalUrl}: ${res.statusText}`);

            const buffer = await res.buffer();
            const id = randomUUID();
            const ext = type === 'image' ? '.png' : '.mp4'; // Default extension
            const filename = `${id}${ext}`;
            const filepath = path.join(UPLOAD_DIR, filename);

            fs.writeFileSync(filepath, buffer);

            const localUrl = `/uploads/assets/${filename}`;
            const mimeType = type === 'image' ? 'image/png' : 'video/mp4';

            // Save to DB
            db.prepare(`
                INSERT INTO assets (id, type, filename, url, size, mime_type)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(id, type, filename, localUrl, buffer.length, mimeType);

            console.log(`[AssetService] Localized ${type}: ${externalUrl} -> ${localUrl}`);
            return localUrl;

        } catch (error) {
            console.error(`[AssetService] Localization failed for ${externalUrl}:`, error);
            // Return original URL as fallback if download fails, to not break the UI
            return externalUrl;
        }
    }
}
