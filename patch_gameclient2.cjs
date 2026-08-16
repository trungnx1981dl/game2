const fs = require('fs');
let code = fs.readFileSync('src/hooks/useGameClient.ts', 'utf8');

code = code.replace(
  "    questions: Question[];",
  "    questions: Question[];\n    originalQuestions: Question[];"
);

code = code.replace(
  "    questions: DEFAULT_QUESTIONS,",
  "    questions: DEFAULT_QUESTIONS,\n    originalQuestions: DEFAULT_QUESTIONS,"
);

// We should also replace the start of initSoloMode
code = code.replace(
  "  const initSoloMode = (customQuestions?: Question[]) => {",
  "  const initSoloMode = (customQuestions?: Question[]) => {\n    const original = customQuestions && customQuestions.length > 0 ? customQuestions : (soloStateRef.current.originalQuestions || DEFAULT_QUESTIONS);\n    soloStateRef.current.originalQuestions = original;"
);

// And fix the questionsToUse creation
code = code.replace(
  "    const questionsToUse = prepareShuffledQuestions(customQuestions && customQuestions.length > 0 ? customQuestions : DEFAULT_QUESTIONS);\n    soloStateRef.current.questions = questionsToUse;",
  "    const questionsToUse = prepareShuffledQuestions(original);\n    soloStateRef.current.questions = questionsToUse;"
);

fs.writeFileSync('src/hooks/useGameClient.ts', code);
console.log('Game client patched 2');
