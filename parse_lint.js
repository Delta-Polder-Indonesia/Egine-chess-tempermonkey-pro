const fs = require('fs');

const raw = fs.readFileSync('lint_results.json', 'utf16le');
const str = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
const data = JSON.parse(str);

const unused = [];

for (const result of data) {
    if (result.messages) {
        for (const msg of result.messages) {
            if (msg.ruleId === 'no-unused-vars') {
                unused.push({
                    line: msg.line,
                    column: msg.column,
                    message: msg.message
                });
            }
        }
    }
}

let out = `Found ${unused.length} unused variables.\n`;
unused.forEach(u => out += `Line ${u.line}: ${u.message}\n`);
fs.writeFileSync('unused_utf8.txt', out, 'utf8');

