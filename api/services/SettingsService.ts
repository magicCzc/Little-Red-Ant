import db from '../db.js';

export class SettingsService {
    private static cache: Record<string, string> | null = null;

    private static ensureCache() {
        if (this.cache === null) {
            const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string, value: string }[];
            this.cache = {};
            rows.forEach(row => {
                this.cache![row.key] = row.value;
            });
        }
    }

    static async get(key: string): Promise<string | null> {
        this.ensureCache();
        return this.cache![key] ?? null;
    }

    static async set(key: string, value: string, description?: string): Promise<void> {
        // Update DB
        const exists = db.prepare('SELECT 1 FROM settings WHERE key = ?').get(key);
        if (exists) {
            db.prepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(value, key);
        } else {
            db.prepare('INSERT INTO settings (key, value, description) VALUES (?, ?, ?)').run(key, value, description || '');
        }

        // Update Cache
        if (this.cache) {
            this.cache[key] = value;
        }
    }

    static async getAll(): Promise<Record<string, string>> {
        this.ensureCache();
        return { ...this.cache! };
    }
}
