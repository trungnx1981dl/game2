const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add soundManager import if not there
if (!code.includes("import { soundManager }")) {
  code = code.replace("import { DEFAULT_QUESTIONS }", "import { soundManager } from './utils/audio';\nimport { DEFAULT_QUESTIONS }");
}

const useEffectHook = `
  React.useEffect(() => {
    if (gameState && gameState.status !== 'LOBBY' && gameState.status !== 'FINAL_RESULT') {
      soundManager.startBGM();
    } else {
      soundManager.stopBGM();
    }
    return () => soundManager.stopBGM();
  }, [gameState?.status]);
`;

code = code.replace("const currentQ =", useEffectHook + "\n  const currentQ =");
fs.writeFileSync('src/App.tsx', code);
console.log('App patched');
