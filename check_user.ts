import db from './api/db.js';

const user = db.prepare('SELECT * FROM users ORDER BY id DESC LIMIT 1').get();
console.log('User found:', user);
