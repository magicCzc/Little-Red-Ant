
import axios from 'axios';

(async () => {
    try {
        console.log('Testing Zhihu API...');
        const url = 'https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=50&desktop=true';
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.zhihu.com/billboard'
            }
        });
        
        const data = response.data;
        if (data && data.data) {
            console.log(`Success! Got ${data.data.length} items.`);
            console.log('First item:', JSON.stringify(data.data[0], null, 2));
        } else {
            console.log('API returned unexpected structure:', JSON.stringify(data).substring(0, 200));
        }
        
    } catch (e) {
        console.error('API Error:', e.message);
        if (e.response) {
            console.error('Status:', e.response.status);
            console.error('Data:', JSON.stringify(e.response.data).substring(0, 200));
        }
    }
})();
