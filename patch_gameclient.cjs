const fs = require('fs');
let code = fs.readFileSync('src/hooks/useGameClient.ts', 'utf8');

if (!code.includes('prepareShuffledQuestions')) {
  code = code.replace("import { soundManager } from '../utils/audio';", "import { soundManager } from '../utils/audio';\nimport { prepareShuffledQuestions } from '../utils/shuffle';");
}

code = code.replace(
  "    const questionsToUse = customQuestions && customQuestions.length > 0 ? customQuestions : DEFAULT_QUESTIONS;\n    soloStateRef.current.questions = questionsToUse;",
  "    const questionsToUse = prepareShuffledQuestions(customQuestions && customQuestions.length > 0 ? customQuestions : DEFAULT_QUESTIONS);\n    soloStateRef.current.questions = questionsToUse;"
);

// We should also check resetGame function to ensure it doesn't lose customQuestions
// Wait, resetGame in solo mode:
// if (isSoloMode) {
//   initSoloMode();
// }
// This would lose customQuestions! We should pass the original ones or the current ones.
// In `initSoloMode`, we could just use `soloStateRef.current.questions` if `customQuestions` is empty? 
// No, the original `customQuestions` might be lost if we shuffle `soloStateRef.current.questions`.
// It's better to store original questions in soloStateRef.
