
const fs = require('fs');
const path = require('path');

// Mock the capture array
let capturedNotes = [];

try {
    const content = fs.readFileSync('e:\\小红蚁\\data\\debug_network_responses.json', 'utf-8');
    const debugResponses = JSON.parse(content);

    console.log(`Loaded ${debugResponses.length} responses.`);

    debugResponses.forEach((response) => {
        const url = response.url;
        const json = response.data; // In the file, 'data' is the parsed JSON body

        // --- Logic from xiaohongshu.ts ---

        // 1. latest_note_data
        if (url.includes('latest_note_data')) {
            const data = json.data;
            let list = [];
            
            if (Array.isArray(data)) {
                list = data;
            } else if (data && Array.isArray(data.notes)) {
                list = data.notes;
            } else if (data && Array.isArray(data.list)) {
                list = data.list;
            } else if (data && data.noteInfo) {
                list = [data.noteInfo];
            }
            
            if (list.length > 0) {
                const normalized = list.map((item) => ({
                    note_id: item.note_id || item.id,
                    title: item.title || item.display_title || 'Untitled',
                    cover_image: item.coverUrl || item.cover?.url || item.images?.[0]?.url || item.cover_image || '',
                    views: item.read_count || item.stats?.read_count || 0,
                    likes: item.likes || item.stats?.likes || 0,
                    comments: item.comments || item.stats?.comments || 0,
                    collects: item.collects || item.stats?.collects || 0,
                }));
                normalized.forEach((n) => {
                    if (!capturedNotes.some(existing => existing.note_id === n.note_id)) {
                        capturedNotes.push(n);
                    }
                });
            }
        }

        // 2. note/base
        if (url.includes('note/base')) {
            const data = json.data?.data || json.data;
            if (data) {
                const stats = {};
                
                if (data.view_count !== undefined) stats.views = data.view_count;
                if (data.like_count !== undefined) stats.likes = data.like_count;
                if (data.comment_count !== undefined) stats.comments = data.comment_count;
                if (data.collect_count !== undefined) stats.collects = data.collect_count;
                
                if (data.note_info) {
                    if (data.note_info.view_count !== undefined) stats.views = data.note_info.view_count;
                    if (data.note_info.like_count !== undefined) stats.likes = data.note_info.like_count;
                    if (data.note_info.comment_count !== undefined) stats.comments = data.note_info.comment_count;
                    if (data.note_info.collect_count !== undefined) stats.collects = data.note_info.collect_count;
                    if (data.note_info.cover_url) stats.cover_image = data.note_info.cover_url;
                    if (data.note_info.title) stats.title = data.note_info.title;
                }

                let noteId = data.note_info?.id || data.id;
                if (!noteId) {
                    const noteIdMatch = url.match(/note_id=([a-zA-Z0-9]+)/);
                    if (noteIdMatch && noteIdMatch[1]) noteId = noteIdMatch[1];
                }
                
                if (noteId) {
                    const existingIndex = capturedNotes.findIndex(n => n.note_id === noteId);
                    
                    if (existingIndex !== -1) {
                        const existing = capturedNotes[existingIndex];
                        capturedNotes[existingIndex] = {
                            ...existing,
                            views: stats.views !== undefined ? stats.views : existing.views,
                            likes: stats.likes !== undefined ? stats.likes : existing.likes,
                            comments: stats.comments !== undefined ? stats.comments : existing.comments,
                            collects: stats.collects !== undefined ? stats.collects : existing.collects,
                            cover_image: (!existing.cover_image && stats.cover_image) ? stats.cover_image : existing.cover_image,
                            title: (existing.title === 'Untitled' && stats.title) ? stats.title : existing.title
                        };
                    } else {
                        if (stats.title || stats.cover_image) {
                             capturedNotes.push({
                                 note_id: noteId,
                                 title: stats.title || 'Untitled',
                                 cover_image: stats.cover_image || '',
                                 views: stats.views || 0,
                                 likes: stats.likes || 0,
                                 comments: stats.comments || 0,
                                 collects: stats.collects || 0
                             });
                        }
                    }
                }
            }
        }

        // 3. note/posted (The List API)
        if (url.includes('note/posted') || url.includes('notes') || url.includes('list')) {
            const data = json.data;
            const notes = data?.notes || data?.data?.notes;
            
            if (Array.isArray(notes) && notes.length > 0) {
                 notes.forEach((item) => {
                     const n = {
                         note_id: item.note_id || item.id,
                         title: item.title || item.display_title || 'Untitled',
                         cover_image: item.images_list?.[0]?.url || item.cover?.url || item.coverUrl || item.cover_image || '',
                         views: item.view_count || item.read_count || 0,
                         likes: item.interact_info?.liked_count || item.likes || item.like_count || item.stats?.likes || 0,
                         comments: item.interact_info?.comment_count || item.comments_count || item.comment_count || item.comments || item.stats?.comments || 0,
                         collects: item.interact_info?.collected_count || item.collected_count || item.collect_count || item.collects || item.stats?.collects || 0,
                     };
                     
                     if (n.note_id) {
                         if (!capturedNotes.some(existing => existing.note_id === n.note_id)) {
                             capturedNotes.push(n);
                         } else {
                              const index = capturedNotes.findIndex(existing => existing.note_id === n.note_id);
                              const existing = capturedNotes[index];
                              capturedNotes[index] = {
                                  ...existing,
                                  ...n,
                                  cover_image: n.cover_image || existing.cover_image,
                                  title: n.title !== 'Untitled' ? n.title : existing.title,
                                  views: n.views > 0 ? n.views : existing.views,
                                  likes: n.likes > 0 ? n.likes : existing.likes,
                                  comments: n.comments > 0 ? n.comments : existing.comments,
                                  collects: n.collects > 0 ? n.collects : existing.collects
                              };
                         }
                     }
                 });
            }
        }
    });

    console.log('\n--- Final Captured Notes ---');
    console.log(JSON.stringify(capturedNotes, null, 2));

} catch (e) {
    console.error(e);
}
