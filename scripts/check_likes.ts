
import db from '../api/db.js';

const notes = db.prepare(`
    SELECT title, likes_count, category, note_url 
    FROM trending_notes 
    ORDER BY likes_count DESC 
    LIMIT 20
`).all();

console.log('Top 20 Notes by Likes:');
console.table(notes.map((n: any) => ({
    title: n.title.slice(0, 20),
    likes: n.likes_count,
    category: n.category
})));

const avgLikes = db.prepare('SELECT AVG(likes_count) as avg FROM trending_notes').get() as any;
console.log('Average Likes:', avgLikes.avg);

const count = db.prepare('SELECT COUNT(*) as c FROM trending_notes').get() as any;
console.log('Total Notes:', count.c);
