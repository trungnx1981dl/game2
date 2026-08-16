const fs = require('fs');
let code = fs.readFileSync('src/hooks/useGameClient.ts', 'utf8');

code = code.replace(
  "    intermissionTimer?: any;",
  "    intermissionTimer?: any;\n    status: string;"
);

code = code.replace(
  "    active: false,",
  "    active: false,\n    status: 'LOBBY',"
);

// initSoloMode
code = code.replace(
  "    setIsSoloMode(true);",
  "    soloStateRef.current.status = 'LOBBY';\n    setIsSoloMode(true);"
);

// startSoloStationIntro
code = code.replace(
  "    setGameState({",
  "    soloStateRef.current.status = 'STATION_INTRO';\n    setGameState({"
);

// startSoloQuestion
code = code.replace(
  "    setGameState({",
  "    soloStateRef.current.status = 'QUESTION_ACTIVE';\n    setGameState({"
);

// finishSoloQuestion
code = code.replace(
  "    setGameState((prev) => {",
  "    soloStateRef.current.status = 'QUESTION_INTERMISSION';\n    setGameState((prev) => {"
);

// endSoloGame
code = code.replace(
  "    setGameState((prev) => {",
  "    soloStateRef.current.status = 'FINAL_RESULT';\n    setGameState((prev) => {"
);

fs.writeFileSync('src/hooks/useGameClient.ts', code);
console.log('Status ref patched');
