const fs = require('fs');
let code = fs.readFileSync('src/utils/audio.ts', 'utf8');

// Remove bgmInterval, bgmGain, startBGM, stopBGM
code = code.replace(/private bgmOscillators[\s\S]*?public stopBGM\(\) {[\s\S]*?}/, '');

fs.writeFileSync('src/utils/audio.ts', code);
console.log('Audio bgm removed');
