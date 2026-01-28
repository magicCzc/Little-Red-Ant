
import db from '../api/db.js';

const notes = db.prepare('SELECT note_id, title FROM note_stats LIMIT 10').all();
console.log(JSON.stringify(notes, null, 2));
