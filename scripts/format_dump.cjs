
const fs = require('fs');
const path = require('path');

const inputPath = path.join('e:\\小红蚁\\data\\debug_page_dump.html');
const outputPath = path.join('e:\\小红蚁\\data\\debug_page_dump_formatted.html');

try {
  let content = fs.readFileSync(inputPath, 'utf-8');
  // Simple formatting: add newlines after closing divs and other common tags to make it readable
  // This isn't a perfect beautifier but enough for grep/read
  content = content.replace(/>/g, '>\n').replace(/</g, '\n<');
  fs.writeFileSync(outputPath, content);
  console.log('Formatted file saved.');
} catch (e) {
  console.error(e);
}
