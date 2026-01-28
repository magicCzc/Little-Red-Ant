
const fs = require('fs');
const path = require('path');

try {
  const content = fs.readFileSync('e:\\小红蚁\\data\\debug_network_responses.json', 'utf-8');
  const responses = JSON.parse(content);
  
  console.log(`Total responses: ${responses.length}`);
  
  responses.forEach((res, index) => {
    if (!res.data) return;
    
    // Check if it has a list-like structure
    const data = res.data.data || res.data;
    
    if (data) {
        const keys = Object.keys(data);
        const arrays = keys.filter(k => Array.isArray(data[k]));
        
        if (arrays.length > 0) {
            console.log(`[${index}] ${res.url}`);
            arrays.forEach(k => {
                console.log(`  - ${k}: Array(${data[k].length})`);
                if (data[k].length > 0) {
                    console.log(`    Sample keys: ${Object.keys(data[k][0]).join(', ')}`);
                }
            });
        }
    }
  });
} catch (e) {
  console.error(e);
}
