
import { Router } from 'express';
import { ComplianceService } from '../services/core/ComplianceService.js';

const router = Router();

// Get all rules
router.get('/rules', (req, res) => {
    try {
        const rules = ComplianceService.getRules();
        res.json(rules);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Add rule
router.post('/rules', (req, res) => {
    const { category, keyword, level, suggestion } = req.body;
    if (!category || !keyword || !level) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        ComplianceService.addRule(category, keyword, level, suggestion);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete rule
router.delete('/rules/:id', (req, res) => {
    try {
        ComplianceService.deleteRule(parseInt(req.params.id));
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Toggle rule
router.patch('/rules/:id/toggle', (req, res) => {
    const { is_enabled } = req.body;
    try {
        ComplianceService.toggleRule(parseInt(req.params.id), is_enabled);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

import { ContentService } from '../services/ai/ContentService.js';

// Check content
router.post('/check', (req, res) => {
    const { content } = req.body;
    if (!content) return res.json({ isCompliant: true, score: 100, blockedWords: [], warningWords: [], suggestions: [] });
    
    try {
        const result = ComplianceService.check(content);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Auto-Fix content
router.post('/fix', async (req, res) => {
    const { content, blockedWords, suggestions } = req.body;
    if (!content) return res.status(400).json({ error: 'Missing content' });
    
    try {
        const fixedContent = await ContentService.fixContentCompliance(content, blockedWords || [], suggestions || []);
        res.json({ fixedContent });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
