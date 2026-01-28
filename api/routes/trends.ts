import { Router } from 'express';
import db from '../db.js';
import { enqueueTask } from '../services/queue.js';

const router = Router();

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Mock fallback
const MOCK_TRENDS = [
    { id: 10, title: '近期热门话题', hot_value: 50000 },
    { id: 11, title: '新人博主流量密码', hot_value: 45000 },
    { id: 12, title: '小红书涨粉技巧', hot_value: 40000 },
];

router.get('/', async (req, res) => {
  try {
    const source = (req.query.source as string) || 'weibo';
    const forceRefresh = req.query.refresh === 'true';
    const now = Date.now();
    
    // 1. Get from DB
    const row = db.prepare('SELECT * FROM trends WHERE source = ?').get(source) as any;
    let data = row ? JSON.parse(row.data) : [];
    const lastUpdate = row ? new Date(row.updated_at).getTime() : 0;
    
    // Convert UTC/Server time to timestamp if needed, but Date(row.updated_at) should work if format is standard
    // sqlite CURRENT_TIMESTAMP is UTC 'YYYY-MM-DD HH:MM:SS'
    // new Date('YYYY-MM-DD HH:MM:SS') treats as local time in some environments or UTC in others.
    // Better to rely on relative check or just accept slight skew.
    
    // Check staleness (offset by timezone if needed, but relative diff is usually safe if consistent)
    // Actually, Date.now() is UTC. sqlite CURRENT_TIMESTAMP is UTC.
    // new Date(string + 'Z') enforces UTC.
    const lastUpdateTs = row ? new Date(row.updated_at + 'Z').getTime() : 0; 
    const isStale = (now - lastUpdateTs) > CACHE_DURATION;

    // 2. Trigger Background Update if needed
    if (forceRefresh || !row || isStale) {
        // Check if task already running
        const pendingTasks = db.prepare(`
            SELECT payload FROM tasks 
            WHERE type = 'SCRAPE_TRENDS' AND (status = 'PENDING' OR status = 'PROCESSING')
        `).all() as any[];
        
        const isAlreadyQueued = pendingTasks.some(t => {
            try {
                const p = JSON.parse(t.payload);
                return p.source === source;
            } catch(e) { return false; }
        });

        if (!isAlreadyQueued) {
            console.log(`Triggering background scrape for ${source} (Stale: ${isStale}, Force: ${forceRefresh})`);
            enqueueTask('SCRAPE_TRENDS', { source });
        }
    }

    // 3. Return Response
    if (!row && data.length === 0) {
        // Fallback to mock if we have absolutely nothing in DB
        return res.json({
            source: 'mock',
            updatedAt: now,
            data: MOCK_TRENDS,
            status: 'UPDATING'
        });
    }

    return res.json({
        source: source,
        updatedAt: lastUpdateTs,
        data: data,
        status: isStale ? 'UPDATING' : 'FRESH'
    });

  } catch (error) {
    console.error('Error fetching trends:', error);
    // Fallback to mock
    res.json({
      source: 'mock',
      updatedAt: Date.now(),
      data: MOCK_TRENDS
    });
  }
});

export default router;
