
import db from '../api/db.js';

const noteId = '64bc9da7000000000c036834';
console.log(`Resetting data for note ${noteId}...`);

const info = db.prepare('SELECT id, title FROM trending_notes WHERE note_id = ?').get(noteId) as any;
if (info) {
    db.prepare('UPDATE trending_notes SET analysis_result = NULL, content = NULL, transcript = NULL WHERE note_id = ?').run(noteId);
    console.log(`Successfully reset note: ${info.title}`);
} else {
    console.log('Note not found');
}
