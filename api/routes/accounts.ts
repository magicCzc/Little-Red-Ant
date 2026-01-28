import { Router } from 'express';
import db from '../db.js';
import { startCreatorLogin, startMainSiteLogin, getLoginState, openNoteInBrowser } from '../services/rpa/xiaohongshu.js';
import { checkAllAccountsHealth as checkHealth } from '../services/rpa/auth.js';
import { enqueueTask } from '../services/queue.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// Open Note in RPA Browser
router.post('/open-note', async (req, res) => {
  const { noteId } = req.body;
  if (!noteId) return res.status(400).json({ error: 'noteId is required' });
  
  try {
    await openNoteInBrowser(noteId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all accounts
router.get('/', (req, res) => {
  try {
    const accounts = db.prepare(`
        SELECT id, nickname, alias, avatar, is_active, last_used_at, created_at,
               creator_cookies, main_site_cookies, cookies, status,
               persona_desc, tone, writing_sample, niche
        FROM accounts ORDER BY created_at DESC
    `).all();
    // Convert is_active to boolean and check cookie status
    const result = accounts.map((acc: any) => ({
      id: acc.id,
      nickname: acc.nickname,
      alias: acc.alias, // Added alias
      avatar: acc.avatar,
      is_active: Boolean(acc.is_active),
      last_used_at: acc.last_used_at,
      created_at: acc.created_at,
      has_creator_cookie: !!(acc.creator_cookies || acc.cookies),
      has_main_cookie: !!acc.main_site_cookies,
      status: acc.status || 'UNKNOWN', // Expose status
      persona: {
          desc: acc.persona_desc,
          tone: acc.tone,
          sample: acc.writing_sample,
          niche: acc.niche
      }
    }));
    res.json(result);
  } catch (error: any) {
    console.error('Fetch accounts error:', error);
    res.status(500).json({ error: `Failed to fetch accounts: ${error.message}` });
  }
});

// Update Account Alias
router.put('/:id/alias', (req, res) => {
    try {
        const { alias } = req.body;
        db.prepare('UPDATE accounts SET alias = ? WHERE id = ?').run(alias, req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update Account Persona
router.put('/:id/persona', (req, res) => {
    try {
        const { niche, persona_desc, tone, writing_sample } = req.body;
        db.prepare(`
            UPDATE accounts 
            SET niche = ?, persona_desc = ?, tone = ?, writing_sample = ? 
            WHERE id = ?
        `).run(niche, persona_desc, tone, writing_sample, req.params.id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Trigger Manual Health Check
router.post('/check-health', async (req, res) => {
    try {
        const taskId = enqueueTask('CHECK_HEALTH', {});
        res.json({ success: true, taskId, message: 'Health check queued' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Start Creator Login Process (Publishing/Stats)
router.post('/login', async (req, res) => {
  try {
    const { accountId } = req.body;
    await startCreatorLogin(accountId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start Main Site Login Process (Browsing)
router.post('/login-main', async (req, res) => {
  try {
    const { accountId } = req.body;
    if (!accountId) return res.status(400).json({ error: 'Account ID is required for binding browsing permission' });
    await startMainSiteLogin(accountId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check Login Status (Polling)
router.get('/status', (req, res) => {
  const state = getLoginState();
  // Also check if we have a newly added active account
  const activeAccount = db.prepare('SELECT id, nickname FROM accounts WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1').get();
  
  res.json({ 
    loginState: state.status,
    loginType: state.type,
    message: state.message,
    activeAccount
  });
});

// Get Primary Account Status for Badge
router.get('/primary-status', (req, res) => {
    try {
        const account = db.prepare('SELECT id, nickname, avatar, status FROM accounts WHERE is_active = 1 LIMIT 1').get();
        if (!account) return res.status(404).json({ error: 'No active account' });
        res.json(account);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Switch Active Account
router.post('/:id/active', (req, res) => {
  try {
    db.transaction(() => {
      db.prepare('UPDATE accounts SET is_active = 0').run();
      db.prepare('UPDATE accounts SET is_active = 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
    })();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to switch account' });
  }
});

// Delete Account
router.delete('/:id', (req, res) => {
  try {
    const accountId = req.params.id;
    
    // Get account info for file deletion
    const account = db.prepare('SELECT profile_path FROM accounts WHERE id = ?').get(accountId) as { profile_path: string } | undefined;

    // Use transaction to delete all related data
    db.transaction(() => {
        // 1. Get all note_ids belonging to this account
        const notes = db.prepare('SELECT note_id FROM note_stats WHERE account_id = ?').all(accountId) as { note_id: string }[];
        
        if (notes.length > 0) {
            const noteIds = notes.map(n => n.note_id);
            // 2. Delete history for these notes
            // SQLite doesn't support array params easily in IN clause, so we iterate or construct query
            const deleteHistoryStmt = db.prepare('DELETE FROM note_stats_history WHERE note_id = ?');
            noteIds.forEach(id => deleteHistoryStmt.run(id));
        }

        // 3. Delete note_stats
        db.prepare('DELETE FROM note_stats WHERE account_id = ?').run(accountId);

        // 4. Delete account
        db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId);
    })();

    // 5. Delete profile directory if exists
    if (account && account.profile_path) {
        try {
            if (fs.existsSync(account.profile_path)) {
                fs.rmSync(account.profile_path, { recursive: true, force: true });
            }
        } catch (e) {
            console.warn(`Failed to delete profile directory: ${account.profile_path}`, e);
            // Don't fail the request just because file deletion failed
        }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete account' });
  }
});

export default router;