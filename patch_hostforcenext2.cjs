const fs = require('fs');
let code = fs.readFileSync('src/hooks/useGameClient.ts', 'utf8');

const oldForceNext = `  const hostForceNext = () => {
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

const newForceNext = `  const hostForceNext = () => {
    if (isSoloMode) {
      const status = soloStateRef.current.status;
      if (status === 'QUESTION_ACTIVE') {
        finishSoloQuestion();
      } else if (status === 'QUESTION_INTERMISSION') {
        advanceSoloQuestion();
      } else if (status === 'STATION_INTRO') {
        if (soloStateRef.current.stationIntroTimer) {
          clearInterval(soloStateRef.current.stationIntroTimer);
        }
        startSoloQuestion();
      }
    } else if (roomCode && myPlayerId) {
      sendWsMessage('HOST_FORCE_NEXT', { roomCode, playerId: myPlayerId });
    }
  };`;

code = code.replace(oldForceNext, newForceNext);

// And fix skipStationIntro
const oldSkip = `  const skipStationIntro = () => {
    if (isSoloMode) {
      if (soloStateRef.current.stationIntroTimer) {
        clearInterval(soloStateRef.current.stationIntroTimer);
      }
      startSoloQuestion();
    } else if (roomCode && myPlayerId) {`;
const newSkip = `  const skipStationIntro = () => {
    if (isSoloMode) {
      if (soloStateRef.current.status !== 'STATION_INTRO') return;
      if (soloStateRef.current.stationIntroTimer) {
        clearInterval(soloStateRef.current.stationIntroTimer);
      }
      startSoloQuestion();
    } else if (roomCode && myPlayerId) {`;

code = code.replace(oldSkip, newSkip);

fs.writeFileSync('src/hooks/useGameClient.ts', code);
console.log('Force next synchronous patched');
