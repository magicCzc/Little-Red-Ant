import express from 'express';
import { VideoProjectService } from '../services/video/VideoProjectService.js';
import { VideoStitcher } from '../services/video/VideoStitcher.js';
import { TTSService } from '../services/audio/TTSService.js';
import { enqueueTask } from '../services/queue.js';

const router = express.Router();

console.log('[DEBUG] Loading Video Project Routes...');

const stitcher = new VideoStitcher();
const ttsService = new TTSService();

// ... existing code ...

// Generate Audio for Scene
router.post('/scenes/:sceneId/audio', async (req, res) => {
    try {
        const { text, voice } = req.body;
        // In real app, we should check project ownership here
        
        const result = await ttsService.generate(text, voice);
        
        VideoProjectService.updateSceneAudio(req.params.sceneId, result.url, result.duration);
        
        res.json({ success: true, data: result });
    } catch (error: any) {
        console.error('Audio Generation Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// List all projects
router.get('/', (req, res) => {
    console.log('[DEBUG] GET /api/video-projects hit!');
    try {
        const projects = VideoProjectService.listProjects();
        res.json({ success: true, data: projects });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get project details
router.get('/:id', (req, res) => {
    try {
        const project = VideoProjectService.getProject(req.params.id);
        if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
        res.json({ success: true, data: project });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete project
router.delete('/:id', (req, res) => {
    try {
        const projectId = req.params.id;
        VideoProjectService.deleteProject(projectId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update Project Character Description
router.patch('/:id/character', (req, res) => {
    try {
        const { character_desc } = req.body;
        if (character_desc === undefined) return res.status(400).json({ success: false, error: 'character_desc is required' });
        
        VideoProjectService.updateProjectCharacter(req.params.id, character_desc);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create project
router.post('/', (req, res) => {
    try {
        const { title, script, character_desc, tags, description } = req.body;
        if (!title || !script) return res.status(400).json({ success: false, error: 'Missing title or script' });
        
        const project = VideoProjectService.createProject(title, script, character_desc, tags, description);
        res.json({ success: true, data: project });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update Scene Status (Callback or Manual)
router.patch('/scenes/:sceneId', (req, res) => {
    try {
        const { status, videoUrl, taskId } = req.body;
        VideoProjectService.updateSceneStatus(req.params.sceneId, status, videoUrl, taskId);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update Project BGM
router.patch('/:id/bgm', (req, res) => {
    try {
        const { bgmUrl } = req.body;
        if (!bgmUrl) return res.status(400).json({ success: false, error: 'bgmUrl is required' });
        
        VideoProjectService.updateProjectBgm(req.params.id, bgmUrl);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Stitch Videos
router.post('/:id/stitch', async (req, res) => {
    try {
        const project = VideoProjectService.getProject(req.params.id);
        if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

        // Get completed scenes in order
        const validScenes = (project.scenes || []).filter(s => s.status === 'COMPLETED' && s.video_url);
        if (validScenes.length < 2) {
            return res.status(400).json({ success: false, error: 'Not enough completed scenes to stitch' });
        }

        const stitchScenes = validScenes.map(s => ({
            videoUrl: s.video_url!,
            audioUrl: s.audio_url
        }));
        
        // Enqueue Task
        const taskId = enqueueTask('VIDEO_STITCH', {
            projectId: project.id,
            scenes: stitchScenes,
            bgmUrl: project.bgm_url
        });
        
        // Update status to prevent double submission (optional, handled by handler too)
        VideoProjectService.updateProjectStatus(req.params.id, 'GENERATING');

        res.json({ success: true, taskId, message: 'Stitching task queued' });
    } catch (error: any) {
        console.error('Stitch API Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
