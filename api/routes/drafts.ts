import { Router } from 'express';
import db from '../db.js';
import { AssetService } from '../services/asset/AssetService.js';

const router = Router();

// Helper to localize images in background
const localizeImages = async (images: any[]) => {
    if (!images || !Array.isArray(images)) return [];
    
    // Process in parallel
    const localized = await Promise.all(images.map(async (img) => {
        // Support both string URL and object {url, prompt}
        const url = typeof img === 'string' ? img : img.url;
        const prompt = typeof img === 'string' ? '' : img.prompt;

        if (!url) return img;
        
        let localUrl = url;
        // Check if it's an external URL (http/https) and NOT localhost
        if (url.startsWith('http') && !url.includes('localhost')) {
            localUrl = await AssetService.downloadAndLocalize(url, 'image');
        }
        
        // Return in same format as input
        if (typeof img === 'string') return localUrl;
        return { ...img, url: localUrl };
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
      images: JSON.parse(d.images || '[]'),
      meta_data: d.meta_data ? JSON.parse(d.meta_data) : null
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch drafts' });
  }
});

// Create draft
router.post('/', async (req, res) => {
  const { title, content, tags, images, contentType, meta_data } = req.body;
  try {
    // Localize images before saving
    const localImages = await localizeImages(images || []);
    
    const stmt = db.prepare('INSERT INTO drafts (title, content, tags, images, content_type, meta_data) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(title, content, JSON.stringify(tags || []), JSON.stringify(localImages), contentType || 'note', meta_data ? JSON.stringify(meta_data) : null);
    res.json({ id: info.lastInsertRowid, success: true, images: localImages });
  } catch (error) {
    console.error('Create draft failed:', error);
    res.status(500).json({ error: 'Failed to create draft' });
  }
});

// Update draft
router.put('/:id', async (req, res) => {
  const { title, content, tags, images, contentType, meta_data } = req.body;
  try {
    // Localize images before saving
    const localImages = await localizeImages(images || []);

    const stmt = db.prepare('UPDATE drafts SET title = ?, content = ?, tags = ?, images = ?, content_type = COALESCE(?, content_type), meta_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(title, content, JSON.stringify(tags || []), JSON.stringify(localImages), contentType, meta_data ? JSON.stringify(meta_data) : null, req.params.id);
    res.json({ success: true, images: localImages });
  } catch (error) {
    console.error('Update draft failed:', error);
    res.status(500).json({ error: 'Failed to update draft' });
  }
});

import { FileCleanupService } from '../services/core/FileCleanupService.js';

// Delete draft
router.delete('/:id', async (req, res) => {
  try {
    const draftId = req.params.id;
    // 1. Get draft images
    const draft = db.prepare('SELECT images FROM drafts WHERE id = ?').get(draftId) as any;
    
    if (draft) {
        let images: string[] = [];
        try {
            const parsed = JSON.parse(draft.images || '[]');
            // Handle both string[] and object[] format
            images = parsed.map((img: any) => typeof img === 'string' ? img : img.url);
        } catch (e) {}

        // 2. Delete files
        if (images.length > 0) {
            await FileCleanupService.deleteFiles(images);
        }
    }

    // 3. Delete record
    db.prepare('DELETE FROM drafts WHERE id = ?').run(draftId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete draft failed:', error);
    res.status(500).json({ error: 'Failed to delete draft' });
  }
});

export default router;
