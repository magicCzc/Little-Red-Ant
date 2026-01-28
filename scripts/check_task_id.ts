
import db from '../api/db.js';
const task = db.prepare("SELECT * FROM tasks WHERE id = '7b2d2d02-f0ca-493f-9dd0-762b835dfa42'").get();
console.log(task);
