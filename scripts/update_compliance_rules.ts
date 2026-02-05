
import axios from 'axios';
import db, { initDB } from '../api/db.js';
import { ComplianceService } from '../api/services/core/ComplianceService.js';

// Ensure DB is ready
initDB();

interface RuleSource {
    name: string;
    url: string;
    category: 'forbidden' | 'sensitive' | 'ad' | 'medical';
    level: 'BLOCK' | 'WARN';
    parser: (text: string) => string[];
}

// GitHub Proxy to ensure connectivity
const PROXIES = [
    'https://mirror.ghproxy.com/',
    'https://ghproxy.com/',
    'https://cdn.jsdelivr.net/gh/', // Special handling for jsdelivr
];

// Fallback data for XHS (Simulated Scrape Result)
const XHS_FALLBACK = [
    // 极限词
    '第一', '唯一', '顶级', '国家级', '金牌', '首选', '最', '绝无仅有', '万能', '100%', 
    '史无前例', '永久', '王牌', '掌门人', '领袖', '独一无二', '最佳', '最大', '最新技术',
    '全球首发', '全网首发', '世界领先', '顶级工艺', '销量冠军', 'NO.1', 'Top1', '极致',
    
    // 引流/营销
    '微信', '微信号', '加V', '私我', '私信', '主页', '传送门', '链接', '点击', '留号',
    '购买', '下单', '入手', '价格', '多少钱', '米', '某宝', '淘宝', '京东', '拼多多',
    '闲鱼', '转转', '包邮', '免费送', '福利', '抽奖', '秒杀', '抢购', '限时',
    
    // 医疗/功效 (虚假宣传高发区)
    '治疗', '治愈', '药方', '彻底消除', '排毒', '美白', '丰胸', '减肥', '瘦身', '增高',
    '抗癌', '防癌', '降血压', '根治', '无副作用', '纯天然', '不反弹', '特效', '神效',
    
    // 诱导互动
    '点赞', '收藏', '关注', '转发', '评论区见', '蹲', '交作业', '打卡', '互粉', '互赞'
];

async function fetchWithRetry(url: string): Promise<string> {
    // 1. Try Direct
    try {
        console.log(`   Trying direct access: ${url}`);
        const res = await axios.get(url, { timeout: 3000 });
        return res.data;
    } catch (e) { /* ignore */ }

    // 2. Try Proxies
    for (const proxy of PROXIES) {
        try {
            let targetUrl = proxy + url;
            if (proxy.includes('jsdelivr')) {
                // Convert raw github url to jsdelivr format
                // https://raw.githubusercontent.com/user/repo/branch/file -> user/repo@branch/file
                const match = url.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
                if (match) {
                    targetUrl = `https://cdn.jsdelivr.net/gh/${match[1]}/${match[2]}@${match[3]}/${match[4]}`;
                } else {
                    continue;
                }
            }
            
            console.log(`   Trying proxy: ${targetUrl}`);
            const res = await axios.get(targetUrl, { timeout: 5000 });
            return res.data;
        } catch (e) { /* ignore */ }
    }
    
    throw new Error('All connection methods failed');
}

const SOURCES: RuleSource[] = [
    {
        name: '广告违禁词 (Ad)',
        url: 'https://raw.githubusercontent.com/jkiss/sensitive-words/master/ad.txt',
        category: 'ad',
        level: 'BLOCK',
        parser: (text) => text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    },
    {
        name: '色情/低俗 (Sensitive)',
        url: 'https://raw.githubusercontent.com/konsheng/Sensitive-lexicon/master/色情词库.txt',
        category: 'sensitive',
        level: 'BLOCK',
        parser: (text) => text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    },
    {
        name: '小红书特定规则 (XHS Specific)',
        url: 'MOCK_XHS_RULES', 
        category: 'forbidden',
        level: 'BLOCK',
        parser: () => XHS_FALLBACK
    }
];

async function fetchAndSync() {
    console.log('🚀 Starting Compliance Rules Sync...');
    
    let totalAdded = 0;
    let totalUpdated = 0;
    let totalFailed = 0;

    for (const source of SOURCES) {
        console.log(`\n📥 Fetching source: ${source.name}...`);
        
        let keywords: string[] = [];

        try {
            if (source.url === 'MOCK_XHS_RULES') {
                keywords = source.parser('');
                console.log(`   - Loaded ${keywords.length} built-in rules (Simulated Scrape).`);
            } else {
                const data = await fetchWithRetry(source.url);
                keywords = source.parser(data);
                console.log(`   - Fetched ${keywords.length} rules.`);
            }

            // Batch Process
            const stmt = db.prepare(`
                INSERT INTO compliance_rules (category, keyword, level, suggestion, is_enabled)
                VALUES (?, ?, ?, ?, 1)
                ON CONFLICT(keyword) DO UPDATE SET
                category = excluded.category,
                level = excluded.level,
                updated_at = CURRENT_TIMESTAMP
            `);

            const checkStmt = db.prepare('SELECT id FROM compliance_rules WHERE keyword = ?');

            db.transaction(() => {
                for (const word of keywords) {
                    if (!word || word.length < 2) continue; // Skip too short words
                    
                    const exists = checkStmt.get(word);
                    stmt.run(source.category, word, source.level, '');
                    
                    if (exists) {
                        totalUpdated++;
                    } else {
                        totalAdded++;
                    }
                }
            })();

        } catch (error: any) {
            console.error(`❌ Failed to fetch ${source.name}:`, error.message);
            totalFailed++;
        }
    }

    console.log('\n========================================');
    console.log(`✅ Sync Completed`);
    console.log(`- Added: ${totalAdded}`);
    console.log(`- Updated: ${totalUpdated}`);
    console.log(`- Failed Sources: ${totalFailed}`);
    console.log('========================================\n');
}

// Run
fetchAndSync().catch(console.error);
