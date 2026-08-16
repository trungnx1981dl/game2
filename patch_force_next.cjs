const fs = require('fs');
let code = fs.readFileSync('src/hooks/useGameClient.ts', 'utf8');

const oldForceNext = `  const hostForceNext = () => {
    if (isSoloMode) {
      advanceSoloQuestion();
    } else if (roomCode && myPlayerId) {
      sendWsMessage('HOST_FORCE_NEXT', { roomCode, playerId: myPlayerId });
    }
  };`;

const newForceNext = `  const hostForceNext = () => {
    if (isSoloMode) {
      setGameState(currentGameState => {
        if (currentGameState?.status === 'QUESTION_ACTIVE') {
          setTimeout(finishSoloQuestion, 0);
        } else if (currentGameState?.status === 'QUESTION_INTERMISSION') {
          setTimeout(advanceSoloQuestion, 0);
        } else if (currentGameState?.status === 'STATION_INTRO') {
          setTimeout(startSoloQuestion, 0);
        }
        return currentGameState;
      });
    } else if (roomCode && myPlayerId) {
      sendWsMessage('HOST_FORCE_NEXT', { roomCode, playerId: myPlayerId });
    }
  };`;

code = code.replace(oldForceNext, newForceNext);
fs.writeFileSync('src/hooks/useGameClient.ts', code);
console.log('Force next patched');
