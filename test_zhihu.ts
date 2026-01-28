
import { fetchZhihuHotSearch } from './api/services/crawler/zhihu.js';

(async () => {
    try {
        console.log('Testing Zhihu Crawler...');
        const trends = await fetchZhihuHotSearch();
        console.log('Result:', JSON.stringify(trends, null, 2));
    } catch (e) {
        console.error('Test Failed:', e);
    }
})();
