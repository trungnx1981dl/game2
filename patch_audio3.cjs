const fs = require('fs');
let code = fs.readFileSync('src/utils/audio.ts', 'utf8');

code = code.replace(/if \\(this\\.bgmGain\\) \\{[\\s\\S]*?\\}\\s*\\}/, '');

fs.writeFileSync('src/utils/audio.ts', code);
console.log('Audio bgm extra removed');
