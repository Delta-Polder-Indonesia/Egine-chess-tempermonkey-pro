const fs = require('fs');
let code = fs.readFileSync('c:\\Users\\TRIA NANDA ADISTI\\Downloads\\chess engine 3.js', 'utf8');

function removeFunction(funcName) {
    const regex = new RegExp(`function ${funcName}\\s*\\([^)]*\\)\\s*\\{`);
    const match = code.match(regex);
    if (!match) {
        console.log("Could not find function: " + funcName);
        return;
    }
    const startIdx = match.index;
    let openBraces = 0;
    let endIdx = -1;
    let inString = false;
    let stringChar = '';

    for (let i = startIdx + match[0].length - 1; i < code.length; i++) {
        const char = code[i];

        if (!inString) {
            if (char === "'" || char === '"' || char === '\`') {
                inString = true;
                stringChar = char;
            } else if (char === '{') {
                openBraces++;
            } else if (char === '}') {
                openBraces--;
                if (openBraces === 0) {
                    endIdx = i;
                    break;
                }
            }
        } else {
            if (char === '\\') { i++; }
            else if (char === stringChar) { inString = false; }
        }
    }

    if (endIdx !== -1) {
        // preserve line numbers
        const segment = code.substring(startIdx, endIdx + 1);
        const newlines = segment.match(/\\n/g) || [];
        const replacement = '\\n'.repeat(newlines.length);
        code = code.substring(0, startIdx) + replacement + code.substring(endIdx + 1);
        console.log(`Removed function: ${funcName} (replaced with empty lines)`);
    } else {
        console.log("Failed to match ending brace for: " + funcName);
    }
}

removeFunction("detectForks");
removeFunction("detectDiscoveredAttack");
removeFunction("detectPinPotential");
removeFunction("detectOpponentForks");
removeFunction("detectQueenTrap");
removeFunction("detectLeftBehind");
removeFunction("detectPreventedThreats");
removeFunction("calculatePremoveChance");
removeFunction("clearVisualsOnGameEnd");

fs.writeFileSync('c:\\Users\\TRIA NANDA ADISTI\\Downloads\\chess engine 3.js', code, 'utf8');
