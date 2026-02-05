
import db from './api/db.js';
import { verifySessionWithRequest, getCookies } from './api/services/rpa/auth.js';
import axios from 'axios';

async function debug() {
    console.log('--- DEBUG START ---');

    // 1. Get the active account
    const account = db.prepare('SELECT id, nickname, creator_cookies, is_active FROM accounts WHERE is_active = 1 OR creator_cookies IS NOT NULL LIMIT 1').get() as any;

    if (!account) {
        console.error('No account found!');
        return;
    }

    console.log('Target Account:', {
        id: account.id,
        nickname: account.nickname,
        has_cookies: !!account.creator_cookies,
        cookie_length: account.creator_cookies?.length
    });

    if (account.creator_cookies) {
        try {
            const parsed = JSON.parse(account.creator_cookies);
            console.log('Cookie Format Type:', Array.isArray(parsed) ? 'Array' : (parsed.cookies ? 'Playwright Object' : 'Unknown'));
            
            const cookies = getCookies('CREATOR', account.id);
            console.log('getCookies() result length:', cookies?.length);

            if (cookies && cookies.length > 0) {
                console.log('Sample Cookie:', cookies[0].name, '=', cookies[0].value.substring(0, 10) + '...');
                
                // 2. Test verifySessionWithRequest
                console.log('\nTesting verifySessionWithRequest...');
                const result = await verifySessionWithRequest(account.id);
                console.log('verifySessionWithRequest Result:', result);

                // 3. Manual Axios Test if failed
                if (!result) {
                    console.log('\n--- MANUAL AXIOS TEST ---');
                    const cookieHeader = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
                    
                    try {
                        const res = await axios.get('https://creator.xiaohongshu.com/api/creator/user/info', {
                            headers: {
                                'Cookie': cookieHeader,
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Referer': 'https://creator.xiaohongshu.com/creator/home',
                                'Accept': 'application/json, text/plain, */*'
                            },
                            validateStatus: () => true,
                            maxRedirects: 0
                        });

                        console.log('Response Status:', res.status);
                        console.log('Response Headers:', res.headers);
                        console.log('Response Data Code:', res.data?.code);
                        console.log('Response Data:', JSON.stringify(res.data).substring(0, 200));

                    } catch (e: any) {
                        console.error('Manual Axios Error:', e.message);
                        if (e.response) {
                            console.log('Error Response Status:', e.response.status);
                            console.log('Error Response Location:', e.response.headers['location']);
                        }
                    }
                }

            } else {
                console.error('getCookies returned empty array');
            }

        } catch (e) {
            console.error('JSON Parse Error:', e);
        }
    }

    console.log('--- DEBUG END ---');
}

debug();
