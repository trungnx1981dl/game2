const fs = require('fs');
let code = fs.readFileSync('src/hooks/useGameClient.ts', 'utf8');

code = code.replace(
  "    stationIntroTimer?: any;",
  "    stationIntroTimer?: any;\n    isQuestionActive?: boolean;\n    intermissionTimer?: any;"
);

code = code.replace(
  "  const finishSoloQuestion = () => {",
  "  const finishSoloQuestion = () => {\n    if (!soloStateRef.current.isQuestionActive) return;\n    soloStateRef.current.isQuestionActive = false;"
);

code = code.replace(
  "    soloStateRef.current.timerInterval = setInterval(() => {",
  "    soloStateRef.current.isQuestionActive = true;\n    soloStateRef.current.timerInterval = setInterval(() => {"
);

code = code.replace(
  "  const advanceSoloQuestion = () => {",
  "  const advanceSoloQuestion = () => {\n    if (soloStateRef.current.intermissionTimer) clearTimeout(soloStateRef.current.intermissionTimer);\n    soloStateRef.current.isQuestionActive = false;"
);

code = code.replace(
  "    // 5 seconds intermission before next question\n    setTimeout(() => {",
  "    // 5 seconds intermission before next question\n    soloStateRef.current.intermissionTimer = setTimeout(() => {"
);

fs.writeFileSync('src/hooks/useGameClient.ts', code);
console.log('Game client patched');
