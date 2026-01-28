
import db from './api/db.js';

try {
    const tableInfo = db.prepare("PRAGMA table_info(trending_notes)").all();
    console.log("Schema for trending_notes:", JSON.stringify(tableInfo, null, 2));

    const count = db.prepare('SELECT COUNT(*) as count FROM trending_notes').get();
    console.log("Row count in trending_notes:", count);
} catch (e) {
    console.error("Error inspecting trending_notes:", e);
}
