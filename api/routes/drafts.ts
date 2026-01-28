import { Router } from 'express';
import db from '../db.js';
import { AssetService } from '../services/asset/AssetService.js';

const router = Router();

// Helper to localize images in background
const localizeImages = async (images: string[]) => {
    if (!images || !Array.isArray(images)) return [];
    
    // Process in parallel
    const localized = await Promise.all(images.map(async (url) => {
        if (!url) return url;
        // Check if it's an external URL (http/https) and NOT localhost
        if (url.startsWith('http') && !url.includes('localhost')) {
            return await AssetService.downloadAndLocalize(url, 'image');
        }
        return url;
    }));
    return localized;
};

// Get all drafts
router.get('/', (req, res) => {
  try {
    const drafts = db.prepare('SELECT * FROM drafts ORDER BY created_at DESC').all();
    res.json(drafts.map((d: any) => ({
      ...d,
      tags: JSON.parse(d.tags || '[]'),
      images: JSON.parse(d.images || '[]')
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch drafts' });
  }
});

// Create draft
router.post('/', async (req, res) => {
  const { title, content, tags, images, contentType } = req.body;
  try {
    // Localize images before saving
    const localImages = await localizeImages(images || []);
    
    const stmt = db.prepare('INSERT INTO drafts (title, content, tags, images, content_type) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(title, content, JSON.stringify(tags || []), JSON.stringify(localImages), contentType || 'note');
    res.json({ id: info.lastInsertRowid, success: true, images: localImages });
  } catch (error) {
    console.error('Create draft failed:', error);
    res.status(500).json({ error: 'Failed to create draft' });
  }
});

// Update draft
router.put('/:id', async (req, res) => {
  const { title, content, tags, images, contentType } = req.body;
  try {
    // Localize images before saving
    const localImages = await localizeImages(images || []);

    const stmt = db.prepare('UPDATE drafts SET title = ?, content = ?, tags = ?, images = ?, content_type = COALESCE(?, content_type), updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(title, content, JSON.stringify(tags || []), JSON.stringify(localImages), contentType, req.params.id);
    res.json({ success: true, images: localImages });
  } catch (error) {
    console.error('Update draft failed:', error);
    res.status(500).json({ error: 'Failed to update draft' });
  }
});

// Delete draft
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM drafts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete draft' });
  }
});

export default router;
