const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

if (!code.includes('prepareShuffledQuestions')) {
  code = code.replace("import { Player, ServerRoom, Question, GameState } from './src/types';", "import { Player, ServerRoom, Question, GameState } from './src/types';\nimport { prepareShuffledQuestions } from './src/utils/shuffle';");
}

// In START_GAME
code = code.replace(
  "        room.currentQuestionIndex = 0;",
  "        room.currentQuestionIndex = 0;\n        room.questions = prepareShuffledQuestions(room.questions);"
);

// In RESET_GAME
code = code.replace(
  "        room.status = 'LOBBY';",
  "        room.status = 'LOBBY';\n        room.questions = prepareShuffledQuestions(room.questions);"
);

fs.writeFileSync('server.ts', code);
console.log('Server patched with shuffle');
