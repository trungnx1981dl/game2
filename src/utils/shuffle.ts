import { Question } from '../types';

export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function prepareShuffledQuestions(questions: Question[]): Question[] {
  // Group by station
  const stations: Record<number, Question[]> = {};
  questions.forEach(q => {
    if (!stations[q.station]) stations[q.station] = [];
    stations[q.station].push(q);
  });

  const sortedStationKeys = Object.keys(stations).map(Number).sort((a, b) => a - b);
  let finalQuestions: Question[] = [];

  for (const stationId of sortedStationKeys) {
    const shuffledStationQuestions = shuffleArray(stations[stationId]);
    
    const processedQuestions = shuffledStationQuestions.map(q => {
      // Clone the question
      const newQ = { ...q };
      
      // Shuffle options for multiple-choice
            if (newQ.type === 'multiple-choice' && newQ.options && newQ.correctAnswer !== undefined) {
        const correctIdx = Number(newQ.correctAnswer);
        const correctOptionText = newQ.options[correctIdx];
        
        const shuffledOptions = shuffleArray(newQ.options);
        const newCorrectIdx = shuffledOptions.findIndex(opt => opt === correctOptionText);
        
        newQ.options = shuffledOptions;
        newQ.correctAnswer = newCorrectIdx;
      } else if (newQ.type === 'true-false' && newQ.trueFalseItems) {
        newQ.trueFalseItems = shuffleArray(newQ.trueFalseItems);
      } else if (newQ.type === 'matching' && newQ.matchingPairs) {
        newQ.matchingPairs = shuffleArray(newQ.matchingPairs);
      } else if (newQ.type === 'fill-blank' && newQ.bankChoices) {
        newQ.bankChoices = shuffleArray(newQ.bankChoices);
      }
      
      return newQ;
    });

    finalQuestions = finalQuestions.concat(processedQuestions);
  }

  return finalQuestions;
}
