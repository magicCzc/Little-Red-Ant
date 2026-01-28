import { Router } from 'express';
import { startCreatorLogin, getLoginState } from '../services/rpa/xiaohongshu.js';
import { enqueueTask } from '../services/queue.js';
import { VideoProjectService } from '../services/video/VideoProjectService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
router.post('/publish', async (req, res) => {
  const { title, content, tags, imageData, videoPath, autoPublish, scheduledAt, accountId, projectId, contentType } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ error: 'Missing content' });
  }
  
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

  // [Pre-flight Check] Verify Session Validity
  try {
      // 1. Check if we have a valid session (Cookie check via lightweight API ping)
      const isSessionValid = await verifySessionWithRequest(accountId);
      
      if (!isSessionValid) {
          return res.status(401).json({ 
              error: '发布失败：账号登录状态已失效。',
              details: 'Cookies verification failed. Please re-login in the Account Manager.',
              code: 'SESSION_EXPIRED'
          });
      }
      
      // 2. Asset Integrity Check (Basic)
      if (imageData && Array.isArray(imageData)) {
           // We could add logic here to check if local files exist, 
           // but most image data comes as Base64 or URLs which are handled in the worker.
      }

  } catch (e) {
      console.warn('[Publish] Pre-flight check warning:', e);
      // We don't block on check error, but we warn.
      // Or should we block? If verification errors out (e.g. network), maybe we shouldn't block.
      // But if it returned false (handled in verifySessionWithRequest), we already returned 401.
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
