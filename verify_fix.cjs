
const fs = require('fs');

let capturedNotes = [];

try {
    const content = fs.readFileSync('e:\\小红蚁\\data\\debug_network_responses.json', 'utf-8');
    const debugResponses = JSON.parse(content);

    debugResponses.forEach((response) => {
        const url = response.url;
        const json = response.data;

        // FIXED CONDITION: check for 'posted' directly
        if (url.includes('posted') || url.includes('notes') || url.includes('list')) {
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
                         }
                     }
                 });
            }
        }
    });

    console.log(JSON.stringify(capturedNotes, null, 2));

} catch (e) {
    console.error(e);
}
