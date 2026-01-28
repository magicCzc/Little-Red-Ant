
import db from '../api/db.js';
const notes = db.prepare('SELECT title, content, note_url, scraped_at FROM trending_notes ORDER BY scraped_at DESC LIMIT 10').all();
console.log(JSON.stringify(notes, null, 2));
