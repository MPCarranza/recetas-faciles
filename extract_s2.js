const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\pilar\\.gemini\\antigravity-ide\\brain\\1529e932-ea1c-462d-b75a-8086ddf1d43e\\.system_generated\\steps\\30\\content.md', 'utf8');

const s2 = content.indexOf('IMAGIN');
console.log(content.substring(s2 - 200, s2 + 2000));
