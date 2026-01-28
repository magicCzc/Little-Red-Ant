
import db from '../api/db.js';

const noteId = '696ded83000000000e00ed36';
const fullUrl = 'https://www.xiaohongshu.com/explore/696ded83000000000e00ed36?xsec_token=ABeP56AB0PQ6rx7uSsbHABeUVTG-xWp8Rgl_BHvGVi4wo%3D&xsec_source=pc_feed';

try {
    const result = db.prepare('UPDATE trending_notes SET note_url = ? WHERE note_id = ?').run(fullUrl, noteId);
    console.log(`Updated note ${noteId} with full URL (with token). Changes: ${result.changes}`);
    
    // Clear analysis so we can re-run
    db.prepare('UPDATE trending_notes SET analysis_result = NULL, transcript = NULL WHERE note_id = ?').run(noteId);
    console.log('Cleared previous analysis result.');
    
} catch (e) {
    console.error('Update failed:', e);
}
