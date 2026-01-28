
import db from '../api/db.js';
const tasks = db.prepare("SELECT id, type, status FROM tasks ORDER BY created_at DESC LIMIT 5").all();
console.log(tasks);
