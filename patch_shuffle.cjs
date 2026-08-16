const fs = require('fs');
let code = fs.readFileSync('src/utils/shuffle.ts', 'utf8');

const replacement = `      if (newQ.type === 'multiple-choice' && newQ.options && newQ.correctAnswer !== undefined) {
        const correctIdx = Number(newQ.correctAnswer);
        const correctOptionText = newQ.options[correctIdx];
        
        const shuffledOptions = shuffleArray(newQ.options);
        const newCorrectIdx = shuffledOptions.findIndex(opt => opt === correctOptionText);
        
        newQ.options = shuffledOptions;
        newQ.correctAnswer = newCorrectIdx;
      } else if (newQ.type === 'true-false' && newQ.options && Array.isArray(newQ.correctAnswer)) {
        const zipped = newQ.options.map((opt, idx) => ({ opt, correct: newQ.correctAnswer[idx] }));
        const shuffledZipped = shuffleArray(zipped);
        newQ.options = shuffledZipped.map(z => z.opt);
        newQ.correctAnswer = shuffledZipped.map(z => z.correct);
      } else if (newQ.type === 'matching' && newQ.matchingPairs) {
        // Shuffle the matching pairs? The UI shuffles the right side anyway.
        // Actually, QuestionView shuffles the right side on render, so we don't strictly need to shuffle the source,
        // but we can shuffle the array of pairs so the left side is in a different order!
        newQ.matchingPairs = shuffleArray(newQ.matchingPairs);
      }`;

code = code.replace(/if \(newQ\.type === 'multiple-choice'.*?correctAnswer = newCorrectIdx;\n      \}/s, replacement);

fs.writeFileSync('src/utils/shuffle.ts', code);
console.log('Shuffle logic improved');
