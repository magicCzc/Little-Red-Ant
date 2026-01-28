
import { fetchDouyinHotSearch } from '../api/services/crawler/douyin.js';

(async () => {
    try {
        console.log('Testing Douyin Crawler...');
        const trends = await fetchDouyinHotSearch();
        console.log('Result:', JSON.stringify(trends, null, 2));
    } catch (e) {
        console.error('Test Failed:', e);
    }
})();
