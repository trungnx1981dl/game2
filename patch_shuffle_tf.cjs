const fs = require('fs');
let code = fs.readFileSync('src/utils/shuffle.ts', 'utf8');

const oldStr = `      } else if (newQ.type === 'true-false' && newQ.options && Array.isArray(newQ.correctAnswer)) {
        const zipped = newQ.options.map((opt, idx) => ({ opt, correct: newQ.correctAnswer[idx] }));
        const shuffledZipped = shuffleArray(zipped);
        newQ.options = shuffledZipped.map(z => z.opt);
        newQ.correctAnswer = shuffledZipped.map(z => z.correct);`;

const newStr = `      } else if (newQ.type === 'true-false' && newQ.trueFalseItems) {
        newQ.trueFalseItems = shuffleArray(newQ.trueFalseItems);`;

code = code.replace(oldStr, newStr);

fs.writeFileSync('src/utils/shuffle.ts', code);
console.log('Shuffle logic true-false fixed');
