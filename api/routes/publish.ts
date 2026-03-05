import { Router } from 'express';
import { startCreatorLogin, getLoginState } from '../services/rpa/xiaohongshu.js';
import { verifySessionWithRequest } from '../services/rpa/auth.js';
import { enqueueTask } from '../services/queue.js';
import { VideoProjectService } from '../services/video/VideoProjectService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateBody } from '../middleware/validation.js';
import { PublishSchema, LoginSchema } from '../schemas/index.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COOKIE_PATH = path.join(__dirname, '../../data/xhs_cookies.json');

// Check Login Status (File check + Memory state check)
router.get('/status', (req, res) => {
  const isLoggedIn = fs.existsSync(COOKIE_PATH);
  const state = getLoginState();
  res.json({ 
    isLoggedIn,
    loginState: state.status,
    message: state.message
  });
});

// Start Login Process (Async) - Default to Creator Login
router.post('/login', async (req, res) => {
  try {
    // Start background process for new account binding
    startCreatorLogin(); 
    res.json({ success: true, message: 'Login process started' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger Publish (Async Task Queue)
router.post('/publish', validateBody(PublishSchema), async (req, res) => {
  const { title, content, tags, imageData, videoPath, autoPublish, scheduledAt, accountId, projectId, draftId, contentType } = req.body;
  
  // Validation handled by middleware
  
  // Resolve video path if provided
  let resolvedVideoPath = videoPath;
  
  if (videoPath) {
      const publicDir = path.resolve(process.cwd(), 'public');
      
      // Check if it's a web-relative path (starts with /outputs or /uploads)
      // On Windows, path.isAbsolute('/outputs/...') returns true, so we need explicit check
      const normalizedPath = videoPath.replace(/\\/g, '/');
      
      if (normalizedPath.startsWith('/outputs/') || normalizedPath.startsWith('/uploads/')) {
          // It is a web-relative path -> resolve to filesystem path
          const relativePath = normalizedPath.substring(1); // Remove leading slash
          resolvedVideoPath = path.join(publicDir, relativePath);
      } else if (!path.isAbsolute(videoPath) && !videoPath.startsWith('http')) {
          // It is a relative path (e.g. "outputs/file.mp4") and not a URL
          resolvedVideoPath = path.join(publicDir, videoPath);
      }
      
      // Verify existence only if it's a local file (not HTTP)
      if (!videoPath.startsWith('http') && !fs.existsSync(resolvedVideoPath)) {
          return res.status(400).json({ error: `Video file not found: ${resolvedVideoPath}` });
      }
  }

  // [Pre-flight Check] REMOVED due to instability with Axios vs XHS Bot Protection.
  // We rely on the Worker (Puppeteer) to handle the session check during actual execution.
  // This prevents false negatives where Axios gets blocked but the browser would succeed.
  
  // 2. Asset Integrity Check (Basic)
  if (imageData && Array.isArray(imageData)) {
       // We could add logic here to check if local files exist, 
       // but most image data comes as Base64 or URLs which are handled in the worker.
  }

  try {
    const taskId = enqueueTask('PUBLISH', { 
        title, 
        content, 
        tags, 
        imageData,
        videoPath: resolvedVideoPath, // Pass resolved absolute path
        autoPublish, // Pass boolean
        accountId, // Pass target account
        projectId, // Pass projectId for status update
        draftId, // Pass draftId for status update
        contentType // Pass content type to worker
    }, scheduledAt); // Pass scheduledAt (optional)
    
    // Update Video Project Status immediately if projectId is present
    if (projectId) {
        VideoProjectService.updateProjectStatus(projectId, 'COMPLETED', undefined, 'PUBLISHING', taskId);
    }
    
    res.json({ success: true, taskId, message: scheduledAt ? 'Scheduled task queued' : 'Task queued' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
