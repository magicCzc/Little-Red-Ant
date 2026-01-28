import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Get Active Persona (Backward Compatibility)
router.get('/', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1').get();
    // Fallback to latest if no active
    const fallback = db.prepare('SELECT * FROM users ORDER BY id DESC LIMIT 1').get();
    
    const target = user || fallback;

    if (target) {
      res.json({
        ...target,
        identity_tags: JSON.parse((target as any).identity_tags as string || '[]'),
        benchmark_accounts: JSON.parse((target as any).benchmark_accounts as string || '[]'),
        writing_samples: JSON.parse((target as any).writing_samples as string || '[]')
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Get All Personas
router.get('/list', (req, res) => {
    try {
        const users = db.prepare('SELECT * FROM users ORDER BY updated_at DESC').all();
        const parsed = users.map((u: any) => ({
            ...u,
            identity_tags: JSON.parse(u.identity_tags || '[]'),
            benchmark_accounts: JSON.parse(u.benchmark_accounts || '[]'),
            writing_samples: JSON.parse(u.writing_samples || '[]')
        }));
        res.json(parsed);
    } catch (e) {
        res.status(500).json({ error: 'Failed to list personas' });
    }
});

// Create New Persona
router.post('/', (req, res) => {
  const { name, niche, identity_tags, style, benchmark_accounts, writing_samples } = req.body;

  try {
      // Deactivate others if this is the first one or requested?
      // For now, new persona is NOT active by default unless it's the first one.
      const count = db.prepare('SELECT COUNT(*) as c FROM users').get() as {c: number};
      const isActive = count.c === 0 ? 1 : 0;

      const stmt = db.prepare(`
        INSERT INTO users (name, niche, identity_tags, style, benchmark_accounts, writing_samples, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        name || `${niche}博主`, // Default name
        niche, 
        JSON.stringify(identity_tags || []), 
        style, 
        JSON.stringify(benchmark_accounts || []),
        JSON.stringify(writing_samples || []),
        isActive
      );

      res.json({ success: true, id: info.lastInsertRowid, message: 'Persona created successfully' });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create persona' });
  }
});

// Update Persona
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { name, niche, identity_tags, style, benchmark_accounts, writing_samples } = req.body;
    
    try {
        const stmt = db.prepare(`
            UPDATE users 
            SET name = ?, niche = ?, identity_tags = ?, style = ?, benchmark_accounts = ?, writing_samples = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        stmt.run(
            name,
            niche, 
            JSON.stringify(identity_tags || []), 
            style, 
            JSON.stringify(benchmark_accounts || []),
            JSON.stringify(writing_samples || []),
            id
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Update failed' });
    }
});

// Activate Persona
router.post('/:id/activate', (req, res) => {
    const { id } = req.params;
    try {
        db.transaction(() => {
            db.prepare('UPDATE users SET is_active = 0').run();
            db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(id);
        })();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Activation failed' });
    }
});

// Delete Persona
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    try {
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

export default router;
