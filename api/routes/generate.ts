import { Router } from 'express';
import db from '../db.js';
import { ContentService } from '../services/ai/ContentService.js';
import { enqueueTask } from '../services/queue.js';
import { AIFactory } from '../services/ai/AIFactory.js';

const router = Router();

router.post('/content', async (req, res) => {
  const { topic, keywords, style, remix_structure, contentType, accountId } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  try {
    // Enqueue Task
    const taskId = enqueueTask('GENERATE_CONTENT', {
      topic,
      keywords,
      style, // Optional override
      remix_structure,
      contentType, // 'note' or 'article'
      accountId // Pass accountId if provided
    });

    res.json({ taskId, status: 'PENDING', message: 'Task queued' });

  } catch (error: any) {
    console.error('Content generation request failed:', error);
    res.status(500).json({ error: error.message || 'Failed to queue content generation' });
  }
});

// New Endpoint: Generate Image (One by One)
router.post('/image', async (req, res) => {
    const { prompt } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    
    try {
        const taskId = enqueueTask('GENERATE_IMAGE', { prompt });
        res.json({ taskId, status: 'PENDING' });
    } catch (error: any) {
        console.error('Image generation request failed:', error);
        res.status(500).json({ error: error.message || 'Failed to queue image generation' });
    }
});

// New Endpoint: Generate Video
router.post('/video', async (req, res) => {
    const { prompt, imageUrl, duration, sceneId, model } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    
    try {
        const taskId = enqueueTask('GENERATE_VIDEO', { prompt, imageUrl, duration, sceneId, model });
        res.json({ taskId, status: 'PENDING' });
    } catch (error: any) {
        console.error('Video generation request failed:', error);
        res.status(500).json({ error: error.message || 'Failed to queue video generation' });
    }
});

// Optimize Prompt
router.post('/optimize-prompt', async (req, res) => {
    try {
        const { prompt, type } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        let optimizedPrompt = '';

        if (type === 'video') {
            // Use specialized video prompt optimizer (English, Structured)
            optimizedPrompt = await ContentService.optimizeVideoPrompt(prompt);
        } else {
            // Generic optimizer (Article/Text)
            const provider = AIFactory.getTextProvider();
            const systemPrompt = `You are an expert prompt engineer for XiaoHongShu (RedNote). 
            Optimize the user's rough idea into a detailed, high-quality prompt.
            Input: "${prompt}"
            Output ONLY the optimized prompt text.`;

            const result = await provider.generateText([
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ]);
            optimizedPrompt = result.replace(/```/g, '').trim();
        }

        res.json({ optimizedPrompt });
    } catch (error: any) {
        console.error('Optimize prompt error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
