
const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(__dirname, '../data/debug_network_responses.json'), 'utf-8');
const responses = JSON.parse(content);
responses.forEach(r => console.log(r.url));
