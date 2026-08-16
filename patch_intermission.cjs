const fs = require('fs');
let code = fs.readFileSync('src/hooks/useGameClient.ts', 'utf8');

code = code.replace(
  "    soloStateRef.current.intermissionTimer = setTimeout(() => {",
  "    if (soloStateRef.current.intermissionTimer) clearTimeout(soloStateRef.current.intermissionTimer);\n    soloStateRef.current.intermissionTimer = setTimeout(() => {"
);

fs.writeFileSync('src/hooks/useGameClient.ts', code);
console.log('Intermission patched');
