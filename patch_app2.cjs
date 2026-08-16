const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/React\.useEffect\(\(\) => {[\s\S]*?soundManager\.stopBGM\(\);[\s\S]*?}, \[gameState\?\.status\]\);/, '');

fs.writeFileSync('src/App.tsx', code);
console.log('App bgm removed');
