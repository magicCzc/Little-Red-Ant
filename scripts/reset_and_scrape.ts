
import db from '../api/db.js';
import { enqueueTask } from '../api/services/queue.js';

// 1. Clear Data
console.log('Clearing all trending notes...');
try {
    db.prepare('DELETE FROM trending_notes').run();
    console.log('Cleared.');
} catch (e) {
    console.error('Failed to clear:', e);
}

// 2. Trigger Scrape
const CATEGORIES = [
    'recommend', 'video', 'fashion', 'beauty', 'food', 'home', 'travel', 'tech', 
    'emotion', 'baby', 'movie', 'knowledge', 'game', 'fitness', 'career', 'pets', 
    'photography', 'art', 'music', 'books', 'automobile', 'wedding', 'outdoors', 
    'acg', 'sports', 'news'
];

console.log('Triggering scrape tasks...');
for (const category of CATEGORIES) {
    try {
        enqueueTask('SCRAPE_TRENDS', { 
            source: 'xiaohongshu', 
            type: 'notes',
            category: category 
        });
        console.log(`Enqueued: ${category}`);
    } catch (e) {
        console.error(`Failed ${category}:`, e);
    }
}
console.log('Done.');
