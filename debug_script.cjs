
const fs = require('fs');

let capturedNotes = [];

try {
    const content = fs.readFileSync('e:\\小红蚁\\data\\debug_network_responses.json', 'utf-8');
    const debugResponses = JSON.parse(content);

    console.log(`Loaded ${debugResponses.length} responses.`);

    debugResponses.forEach((response, idx) => {
        const url = response.url;
        const json = response.data;

        // Debug log for latest_note_data
        if (url.includes('latest_note_data')) {
            console.log(`[${idx}] Found latest_note_data`);
            const data = json.data;
            if (data && data.noteInfo) {
                console.log(`[${idx}] Found noteInfo: ${data.noteInfo.title}`);
            } else {
                console.log(`[${idx}] No noteInfo found. Keys: ${data ? Object.keys(data) : 'null'}`);
            }
        }

        // Debug log for note/posted
        if (url.includes('note/user/posted')) {
            console.log(`[${idx}] Found note/user/posted`);
            const data = json.data;
            // console.log(`[${idx}] Data keys: ${Object.keys(data)}`);
            const notes = data?.notes;
            if (notes) {
                console.log(`[${idx}] Found ${notes.length} notes`);
            } else {
                console.log(`[${idx}] No notes found in data.notes`);
            }
        }
    });

} catch (e) {
    console.error(e);
}
