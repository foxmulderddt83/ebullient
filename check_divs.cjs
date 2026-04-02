const fs = require('fs');

const content = fs.readFileSync('D:/Games/oneday-clone-main/src/components/admin/DocumentTemplates.tsx', 'utf8');

const lines = content.split('\n');
let level = 0;
const openDivs = [];

lines.forEach((line, index) => {
    const lineNumber = index + 1;
    
    // Match <div (but not followed by /), </div>, and <div ... />
    // We'll use a more sophisticated approach: find all <div and check if they are self-closing
    
    let pos = 0;
    while (true) {
        const startIdx = line.indexOf('<div', pos);
        const endIdx = line.indexOf('</div>', pos);
        
        if (startIdx === -1 && endIdx === -1) break;
        
        if (startIdx !== -1 && (endIdx === -1 || startIdx < endIdx)) {
            // Found <div. Now check if it's self-closing on the same line or later lines
            // Actually, let's just look for /> before the next >
            
            // This is getting complicated. Let's just use a regex that matches <div ... > or <div ... />
            // and another for </div>
            
            // For simplicity, let's assume if it's <div and doesn't have /> before > it's opening.
            // But a div can span multiple lines.
            
            level++;
            openDivs.push(lineNumber);
            pos = startIdx + 4;
        } else {
            level--;
            openDivs.pop();
            pos = endIdx + 6;
        }
    }
});

// Wait, the above is still flawed. Let's just use a simple counter for <div and </div> 
// but subtract the number of <div ... />
const totalOpen = (content.match(/<div(?![a-zA-Z0-9])/g) || []).length;
const totalClose = (content.match(/<\/div>/g) || []).length;
const totalSelfClose = (content.match(/<div[^>]*\/>/g) || []).length;

console.log('Total <div:', totalOpen);
console.log('Total </div>:', totalClose);
console.log('Total self-closing <div ... />:', totalSelfClose);
console.log('Balance (Open - Close - SelfClose):', totalOpen - totalClose - totalSelfClose);
