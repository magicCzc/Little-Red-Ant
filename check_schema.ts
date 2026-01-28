import db from './api/db.js';

try {
    const columns = db.prepare("PRAGMA table_info(accounts)").all();
    console.log('Columns in accounts table:', columns.map((c: any) => c.name));
} catch (e) {
    console.error(e);
}
