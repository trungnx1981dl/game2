const fs = require('fs');
let code = fs.readFileSync('src/utils/shuffle.ts', 'utf8');

const oldStr = `      } else if (newQ.type === 'matching' && newQ.matchingPairs) {
        // Shuffle the matching pairs? The UI shuffles the right side anyway.
        // Actually, QuestionView shuffles the right side on render, so we don't strictly need to shuffle the source,
        // but we can shuffle the array of pairs so the left side is in a different order!
        newQ.matchingPairs = shuffleArray(newQ.matchingPairs);
      }`;

const newStr = `      } else if (newQ.type === 'matching' && newQ.matchingPairs) {
        newQ.matchingPairs = shuffleArray(newQ.matchingPairs);
      } else if (newQ.type === 'fill-blank' && newQ.bankChoices) {
        newQ.bankChoices = shuffleArray(newQ.bankChoices);
      }`;

code = code.replace(oldStr, newStr);

fs.writeFileSync('src/utils/shuffle.ts', code);
console.log('Shuffle logic fill-blank fixed');
