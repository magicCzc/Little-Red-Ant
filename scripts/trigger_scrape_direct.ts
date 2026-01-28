
import { enqueueTask } from '../api/services/queue.js';
import db from '../api/db.js';

console.log('Enqueuing scrape task for Xiaohongshu...');
const taskId = enqueueTask('SCRAPE_TRENDS', { source: 'xiaohongshu' });
console.log('Task enqueued:', taskId);
