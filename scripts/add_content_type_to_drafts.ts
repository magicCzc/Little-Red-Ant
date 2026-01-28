import db from '../api/db.js';

console.log('Migrating drafts table...');

try {
    db.prepare("ALTER TABLE drafts ADD COLUMN content_type TEXT DEFAULT 'note'").run();
    console.log('Added content_type column to drafts table.');
} catch (e: any) {
    if (e.message.includes('duplicate column name')) {
        console.log('Column content_type already exists.');
    } else {
        console.error('Migration failed:', e);
    }
}
