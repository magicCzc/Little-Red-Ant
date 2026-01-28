import db from '../db.js';

export class SettingsService {
    static async get(key: string): Promise<string | null> {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
        return row ? row.value : null;
    }

    static async set(key: string, value: string, description?: string): Promise<void> {
        const exists = db.prepare('SELECT 1 FROM settings WHERE key = ?').get(key);
        if (exists) {
            db.prepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(value, key);
        } else {
            db.prepare('INSERT INTO settings (key, value, description) VALUES (?, ?, ?)').run(key, value, description || '');
        }
    }

    static async getAll(): Promise<Record<string, string>> {
        const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string, value: string }[];
        const settings: Record<string, string> = {};
        rows.forEach(row => {
            settings[row.key] = row.value;
        });
        return settings;
    }
}
