/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js' // Admin User Management
import personaRoutes from './routes/user.js' // Persona (Legacy named user.js, should rename but keep for now)
import generateRoutes from './routes/generate.js'
import trendsRoutes from './routes/trends.js'
import publishRoutes from './routes/publish.js'
import draftsRoutes from './routes/drafts.js'
import accountRoutes from './routes/accounts.js'
import analyticsRoutes from './routes/analytics.js'
import tasksRoutes from './routes/tasks.js'
import settingsRoutes from './routes/settings.js'
import commentsRoutes from './routes/comments.js'
import competitorRoutes from './routes/competitor.js'
import promptRoutes from './routes/prompts.js'
import notificationRoutes from './routes/notifications.js'
import trendingNotesRoutes from './routes/trending_notes.js'
import videoProjectRoutes from './routes/video_projects.js'
import assetRoutes from './routes/assets.js'
import noteRoutes from './routes/notes.js'
import complianceRoutes from './routes/compliance.js'
import optimizationRoutes from './routes/optimizations.js'
import configRoutes from './routes/config.js'
import db, { initDB } from './db.js'
import { authenticateToken } from './middleware/auth.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

// init db
initDB()

// Reset zombie tasks (PROCESSING -> PENDING) on startup
try {
  const result = db.prepare("UPDATE tasks SET status = 'PENDING' WHERE status = 'PROCESSING'").run();
  if (result.changes > 0) {
    console.log(`[Startup] Recovered ${result.changes} zombie tasks (PROCESSING -> PENDING)`);
  }
} catch (error) {
  console.error('[Startup] Failed to recover zombie tasks:', error);
}

const app: express.Application = express()

app.use(cors())
app.use(cookieParser())
app.use(express.json({ limit: '50mb' })) // Increase limit for image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Serve static files from public directory (e.g., uploads, audio)
app.use(express.static(path.join(process.cwd(), 'public')));

/**
 * API Routes
 */
// Public Routes
app.use('/api/auth', authRoutes)
app.use('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ success: true, message: 'ok' })
})

// Protected Routes
app.use('/api/user', authenticateToken, personaRoutes)
app.use('/api/users', authenticateToken, userRoutes)
app.use('/api/generate', authenticateToken, generateRoutes)
app.use('/api/trends', authenticateToken, trendsRoutes)
app.use('/api/publish', authenticateToken, publishRoutes)
app.use('/api/drafts', authenticateToken, draftsRoutes)
app.use('/api/accounts', authenticateToken, accountRoutes)
app.use('/api/analytics', authenticateToken, analyticsRoutes)
app.use('/api/tasks', authenticateToken, tasksRoutes)
app.use('/api/settings', authenticateToken, settingsRoutes)
app.use('/api/comments', authenticateToken, commentsRoutes)
app.use('/api/competitors', authenticateToken, competitorRoutes)
app.use('/api/prompts', authenticateToken, promptRoutes)
app.use('/api/notifications', authenticateToken, notificationRoutes)
app.use('/api/trending-notes', authenticateToken, trendingNotesRoutes)
app.use('/api/notes', authenticateToken, noteRoutes)
app.use('/api/compliance', authenticateToken, complianceRoutes)
app.use('/api/optimizations', authenticateToken, optimizationRoutes)
app.use('/api/config', authenticateToken, configRoutes)

// Temporarily expose these for debugging/stability (or maybe user token is missing in frontend request?)
// Actually, let's keep auth but ensure the routes are mounted correctly.
// They seem correct.
// Let's try to move them UP to see if something shadows them, OR remove auth to test.
// Given the user is "admin" in screenshot, auth should be fine.
// But 404 means "Not Found" by Express.
// Wait, if `video_projects.ts` had a syntax error, the import `import videoProjectRoutes` might have failed silently 
// or returned undefined/empty object if error handling was weird in `tsx` loader? 
// No, we saw crash.
// Now crash is gone.
// Let's explicitly log when these routes are hit to debug.

app.use('/api/video-projects', authenticateToken, videoProjectRoutes)
app.use('/api/assets', authenticateToken, assetRoutes)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
