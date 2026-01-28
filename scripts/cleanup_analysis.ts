
import db from '../api/db.js';

console.log('Starting cleanup of potentially hallucinated video analysis...');

try {
    // 1. Reset any video notes that have analysis but no transcript (hallucinations)
    // Actually, to be safe, let's reset ALL video analysis results so user can re-trigger with the new logic.
    const result = db.prepare(`
        UPDATE trending_notes 
        SET analysis_result = NULL, transcript = NULL 
        WHERE type = 'video' AND analysis_result IS NOT NULL
    `).run();
    
    console.log(`Cleaned up ${result.changes} video notes.`);
    
    // 2. Also reset content for the specific note we were debugging
    const specificNoteId = '64bc9da7000000000c036834';
    db.prepare('UPDATE trending_notes SET content = NULL, analysis_result = NULL WHERE note_id = ?').run(specificNoteId);
    console.log(`Reset specific debug note: ${specificNoteId}`);

} catch (e) {
    console.error('Cleanup failed:', e);
}
