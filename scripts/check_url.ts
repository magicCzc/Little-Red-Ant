
import db from '../api/db.js';
const notes = db.prepare('SELECT title, note_url, note_id FROM trending_notes LIMIT 5').all();
console.log(JSON.stringify(notes, null, 2));
