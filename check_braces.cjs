const fs = require('fs');
const content = fs.readFileSync('D:/Games/oneday-clone-main/src/components/admin/DocumentTemplates.tsx', 'utf8');

let level = 0;
let lastOpen = [];

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '{') {
        level++;
        // Get line number
        const line = content.substring(0, i).split('\n').length;
        lastOpen.push(line);
    } else if (char === '}') {
        level--;
        lastOpen.pop();
    }
}

console.log('Final level:', level);
if (level !== 0) {
    console.log('Unclosed { at lines:', lastOpen);
}
