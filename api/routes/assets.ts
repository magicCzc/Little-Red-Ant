import express from 'express';
import { upload, AssetService } from '../services/asset/AssetService.js';

const router = express.Router();

// Generic Upload Handler
router.post('/upload/:type', upload.single('file'), (req, res) => {
    try {
        const { type } = req.params;
        if (!['audio', 'image', 'video'].includes(type)) {
            return res.status(400).json({ success: false, error: 'Invalid asset type' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        const asset = AssetService.saveAssetRecord(req.file, type as 'audio' | 'image' | 'video');
        res.json({ success: true, data: asset });
    } catch (error: any) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Proxy Endpoint for Image Loading
router.get('/proxy', async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
        return res.status(400).send('URL is required');
    }

    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url, {
            headers: {
                'Referer': 'https://www.xiaohongshu.com/', // Fake referer
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

        // Pipe the image directly to response
        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        
        // Cache for 1 hour
        res.setHeader('Cache-Control', 'public, max-age=3600');
        
        response.body.pipe(res);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).send('Failed to load image');
    }
});

// List Assets
router.get('/', (req, res) => {
    try {
        const { type } = req.query;
        const assets = AssetService.listAssets(type as string);
        res.json({ success: true, data: assets });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
