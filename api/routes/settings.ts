import { Router } from 'express';
import { SettingsService } from '../services/SettingsService.js';
import { startSyncJob } from '../services/cron.js';
import { requireAdmin } from '../middleware/roles.js';

const router = Router();

// Get all settings
router.get('/', async (req, res) => {
    try {
        const settings = await SettingsService.getAll();
        res.json(settings);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update settings (Bulk or Single)
router.post('/', requireAdmin, async (req, res) => {
    try {
        const updates = req.body; // Expect { key: value, key2: value2 }
        
        for (const [key, value] of Object.entries(updates)) {
            // Basic validation if needed
            if (typeof value === 'string') {
                await SettingsService.set(key, value);
                
                // If sync schedule changed, restart cron job
                if (key === 'SYNC_SCHEDULE') {
                    startSyncJob(value);
                }
            }
        }
        
        res.json({ success: true, message: 'Settings updated' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
