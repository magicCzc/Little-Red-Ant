
const fs = require('fs');
const content = fs.readFileSync('e:\\小红蚁\\data\\debug_network_responses.json', 'utf-8');
const responses = JSON.parse(content);
responses.forEach(r => console.log(r.url));
