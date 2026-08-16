import { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Player, Question, SkillType } from '../types';
import { DEFAULT_QUESTIONS } from '../data/defaultQuestions';
import { soundManager } from '../utils/audio';
import { prepareShuffledQuestions } from '../utils/shuffle';

export function useGameClient() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [eliminatedOptionIndices, setEliminatedOptionIndices] = useState<number[]>([]);
  const [isSoloMode, setIsSoloMode] = useState(false);

  // Solo mode local state
  const soloStateRef = useRef<{
    active: boolean;
    questions: Question[];
    originalQuestions: Question[];
    currentQIdx: number;
    player: Player;
    botPlayers: Player[];
    questionStartTime: number;
    timerInterval?: any;
    stationIntroTimer?: any;
    isQuestionActive?: boolean;
    intermissionTimer?: any;
    status: string;
  }>({
    active: false,
    status: 'LOBBY',
    questions: DEFAULT_QUESTIONS,
    originalQuestions: DEFAULT_QUESTIONS,
    currentQIdx: 0,
    player: {
      id: 'solo_player',
      name: 'Bạn (Người Khám Phá)',
      avatar: '🌟',
      isHost: true,
      isReady: true,
      score: 0,
      exp: 0,
      correctCount: 0,
      totalTimeMs: 0,
      hasSubmitted: false,
      activeSkills: {},
    },
    botPlayers: [
      {
        id: 'bot_1',
        name: 'Chiến Binh Sao Vàng',
        avatar: '🦁',
        isHost: false,
        isReady: true,
        score: 0,
        exp: 0,
        correctCount: 0,
        totalTimeMs: 0,
        hasSubmitted: false,
        activeSkills: {},
      },
      {
        id: 'bot_2',
        name: 'Gió Ngàn Chiến Khu',
        avatar: '🦅',
        isHost: false,
        isReady: true,
        score: 0,
        exp: 0,
        correctCount: 0,
        totalTimeMs: 0,
        hasSubmitted: false,
        activeSkills: {},
      },
    ],
    questionStartTime: 0,
  });

  const connectWs = useCallback(() => {
    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setIsConnected(true);
        setErrorMsg(null);
      };

      socket.onclose = () => {
        setIsConnected(false);
        // Attempt reconnect after 3s if in multiplayer mode
        setTimeout(() => {
          if (!isSoloMode) {
            connectWs();
          }
        }, 3000);
      };

      socket.onerror = (err) => {
        console.warn('WebSocket connection warning:', err);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleServerMessage(msg);
        } catch (e) {
          console.error('Error handling WS message', e);
        }
      };

      setWs(socket);
    } catch (e) {
      console.warn('WebSocket init exception:', e);
    }
  }, [isSoloMode]);

  useEffect(() => {
    connectWs();
    return () => {
      if (ws) ws.close();
    };
  }, []);

  const handleServerMessage = (msg: any) => {
    switch (msg.type) {
      case 'ROOM_CREATED':
        setRoomCode(msg.roomCode);
        setMyPlayerId(msg.playerId);
        setIsHost(true);
        setIsSoloMode(false);
        break;

      case 'ROOM_JOINED':
        setRoomCode(msg.roomCode);
        setMyPlayerId(msg.playerId);
        setIsHost(false);
        setIsSoloMode(false);
        break;

      case 'ROOM_STATE':
        setGameState(msg.state);
        if (msg.serverTime) {
          setServerTimeOffset(Date.now() - msg.serverTime);
        }
        break;

      case 'SKILL_ACTIVATED':
        soundManager.playSkill();
        if (msg.skillType === 'fifty_fifty' && msg.eliminatedIndices) {
          setEliminatedOptionIndices(msg.eliminatedIndices);
        }
        break;

      case 'ROUND_3_LOCKED':
        soundManager.playLockout();
        break;

      case 'ERROR':
        setErrorMsg(msg.message);
        break;
    }
  };

  const sendWsMessage = (type: string, payload: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  };

  // ---------------- MULTIPLAYER ACTIONS ----------------
  const createRoom = (playerName: string, avatar: string, customQuestions?: Question[]) => {
    setIsSoloMode(false);
    sendWsMessage('CREATE_ROOM', { playerName, avatar, customQuestions });
  };

  const joinRoom = (code: string, playerName: string, avatar: string) => {
    setIsSoloMode(false);
    sendWsMessage('JOIN_ROOM', { roomCode: code, playerName, avatar });
  };

  const startGame = () => {
    if (isSoloMode) {
      startSoloGame();
    } else if (roomCode && myPlayerId) {
      sendWsMessage('START_GAME', { roomCode, playerId: myPlayerId });
    }
  };

  const skipStationIntro = () => {
    if (isSoloMode) {
      startSoloQuestion();
    } else if (roomCode && myPlayerId) {
      sendWsMessage('SKIP_STATION_INTRO', { roomCode, playerId: myPlayerId });
    }
  };

  const submitAnswer = (answer: any, x2Boost: boolean = false) => {
    if (isSoloMode) {
      submitSoloAnswer(answer, x2Boost);
    } else if (roomCode && myPlayerId) {
      sendWsMessage('SUBMIT_ANSWER', { roomCode, playerId: myPlayerId, answer, x2Boost });
    }
  };

  const castSkill = (skillType: SkillType, targetPlayerId?: string) => {
    if (isSoloMode) {
      castSoloSkill(skillType);
    } else if (roomCode && myPlayerId) {
      sendWsMessage('CAST_SKILL', { roomCode, playerId: myPlayerId, skillType, targetPlayerId });
    }
  };

  const hostForceNext = () => {
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
  };

  const resetGame = () => {
    if (isSoloMode) {
      initSoloMode();
    } else if (roomCode && myPlayerId) {
      sendWsMessage('RESET_GAME', { roomCode, playerId: myPlayerId });
    }
  };

  const leaveRoom = () => {
    if (soloStateRef.current.stationIntroTimer) {
      clearInterval(soloStateRef.current.stationIntroTimer);
    }
    if (soloStateRef.current.timerInterval) {
      clearInterval(soloStateRef.current.timerInterval);
    }
    if (roomCode && myPlayerId && !isSoloMode) {
      sendWsMessage('LEAVE_ROOM', { roomCode, playerId: myPlayerId });
    }
    setRoomCode(null);
    setGameState(null);
    setMyPlayerId(null);
    setIsHost(false);
    setIsSoloMode(false);
    setEliminatedOptionIndices([]);
    setErrorMsg(null);
  };

  // ---------------- SOLO DISCOVERY ENGINE ----------------
  const initSoloMode = (customQuestions?: Question[]) => {
    const original = customQuestions && customQuestions.length > 0 ? customQuestions : (soloStateRef.current.originalQuestions || DEFAULT_QUESTIONS);
    soloStateRef.current.originalQuestions = original;
    soloStateRef.current.status = 'LOBBY';
    setIsSoloMode(true);
    setRoomCode('SOLO-ARENA');
    setMyPlayerId('solo_player');
    setIsHost(true);
    setEliminatedOptionIndices([]);

    const questionsToUse = prepareShuffledQuestions(original);
    soloStateRef.current.questions = questionsToUse;
    soloStateRef.current.currentQIdx = 0;

    const initialPlayer: Player = {
      id: 'solo_player',
      name: 'Bạn (Chiến Binh Solo)',
      avatar: '🌟',
      isHost: true,
      isReady: true,
      score: 0,
      exp: 0,
      correctCount: 0,
      totalTimeMs: 0,
      hasSubmitted: false,
      activeSkills: {},
    };

    const initialBots: Player[] = [
      {
        id: 'bot_1',
        name: 'Đại Bàng Chiến Khu',
        avatar: '🦅',
        isHost: false,
        isReady: true,
        score: 0,
        exp: 0,
        correctCount: 0,
        totalTimeMs: 0,
        hasSubmitted: false,
        activeSkills: {},
      },
      {
        id: 'bot_2',
        name: 'Chiến Binh Sao Vàng',
        avatar: '🦁',
        isHost: false,
        isReady: true,
        score: 0,
        exp: 0,
        correctCount: 0,
        totalTimeMs: 0,
        hasSubmitted: false,
        activeSkills: {},
      },
    ];

    soloStateRef.current.player = initialPlayer;
    soloStateRef.current.botPlayers = initialBots;

    const playersMap: Record<string, Player> = {
      solo_player: initialPlayer,
      bot_1: initialBots[0],
      bot_2: initialBots[1],
    };

    soloStateRef.current.status = 'STATION_INTRO';
    soloStateRef.current.status = 'QUESTION_ACTIVE';
    setGameState({
      roomCode: 'SOLO-ARENA',
      status: 'LOBBY',
      currentStation: 1,
      currentQuestionIndex: 0,
      questions: questionsToUse,
      totalQuestions: questionsToUse.length,
      stationIntroTimeRemaining: 15,
      questionStartTime: 0,
      timeLimitSeconds: 30,
      timeRemainingSeconds: 30,
      allSubmitted: false,
      round3LockedBy: null,
      players: playersMap,
    });
  };

  const startSoloGame = () => {
    const q = soloStateRef.current.questions[0];
    startSoloStationIntro(q ? q.station : 1);
  };

  const startSoloStationIntro = (station: any) => {
    let remaining = 15;
    const playersMap: Record<string, Player> = {
      solo_player: soloStateRef.current.player,
      bot_1: soloStateRef.current.botPlayers[0],
      bot_2: soloStateRef.current.botPlayers[1],
    };

    setGameState((prev) => ({
      roomCode: 'SOLO-ARENA',
      status: 'STATION_INTRO',
      currentStation: station,
      currentQuestionIndex: soloStateRef.current.currentQIdx,
      questions: soloStateRef.current.questions,
      totalQuestions: soloStateRef.current.questions.length,
      stationIntroTimeRemaining: remaining,
      questionStartTime: 0,
      timeLimitSeconds: 30,
      timeRemainingSeconds: 30,
      allSubmitted: false,
      round3LockedBy: null,
      players: playersMap,
    }));

    if (soloStateRef.current.stationIntroTimer) clearInterval(soloStateRef.current.stationIntroTimer);

    soloStateRef.current.stationIntroTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(soloStateRef.current.stationIntroTimer);
        startSoloQuestion();
      } else {
        setGameState((prev) => (prev ? { ...prev, stationIntroTimeRemaining: remaining } : null));
      }
    }, 1000);
  };

  const startSoloQuestion = () => {
    if (soloStateRef.current.stationIntroTimer) clearInterval(soloStateRef.current.stationIntroTimer);
    if (soloStateRef.current.timerInterval) clearInterval(soloStateRef.current.timerInterval);

    const q = soloStateRef.current.questions[soloStateRef.current.currentQIdx];
    if (!q) {
      endSoloGame();
      return;
    }

    setEliminatedOptionIndices([]);
    const startTime = Date.now();
    soloStateRef.current.questionStartTime = startTime;

    // Reset player states
    soloStateRef.current.player.hasSubmitted = false;
    soloStateRef.current.player.submittedAnswer = undefined;
    soloStateRef.current.player.isCorrect = undefined;
    soloStateRef.current.player.earnedScore = undefined;
    soloStateRef.current.player.activeSkills.x2Score = false;
    soloStateRef.current.player.activeSkills.usedFiftyFifty = false;

    soloStateRef.current.botPlayers.forEach((b) => {
      b.hasSubmitted = false;
      b.submittedAnswer = undefined;
      b.isCorrect = undefined;
      b.earnedScore = undefined;
    });

    const playersMap: Record<string, Player> = {
      solo_player: { ...soloStateRef.current.player },
      bot_1: { ...soloStateRef.current.botPlayers[0] },
      bot_2: { ...soloStateRef.current.botPlayers[1] },
    };

    setGameState({
      roomCode: 'SOLO-ARENA',
      status: 'QUESTION_ACTIVE',
      currentStation: q.station,
      currentQuestionIndex: soloStateRef.current.currentQIdx,
      questions: soloStateRef.current.questions,
      totalQuestions: soloStateRef.current.questions.length,
      stationIntroTimeRemaining: 0,
      questionStartTime: startTime,
      timeLimitSeconds: q.timeLimit,
      timeRemainingSeconds: q.timeLimit,
      allSubmitted: false,
      round3LockedBy: null,
      players: playersMap,
    });

    // Simulate bot answers with random realistic timing & accuracy
    soloStateRef.current.botPlayers.forEach((bot, idx) => {
      const botDelay = (Math.random() * 0.4 + 0.2 + idx * 0.15) * q.timeLimit * 1000;
      setTimeout(() => {
        if (soloStateRef.current.currentQIdx === soloStateRef.current.questions.indexOf(q)) {
          const isCorrect = Math.random() > 0.35;
          const score = isCorrect ? Math.round(q.baseScore * (botDelay < 5000 ? 1.8 : 1.2)) : 0;
          bot.hasSubmitted = true;
          bot.isCorrect = isCorrect;
          bot.earnedScore = score;
          bot.score += score;
          bot.exp = Math.min(100, bot.exp + (isCorrect ? 10 : 0));
          if (isCorrect) bot.correctCount += 1;
          bot.totalTimeMs += botDelay;

          soloStateRef.current.status = 'QUESTION_INTERMISSION';
    soloStateRef.current.status = 'FINAL_RESULT';
    setGameState((prev) => {
            if (!prev || prev.status !== 'QUESTION_ACTIVE') return prev;
            return {
              ...prev,
              players: {
                ...prev.players,
                [bot.id]: { ...bot },
              },
            };
          });
        }
      }, botDelay);
    });

    // Question countdown timer
    let remaining = q.timeLimit;
    soloStateRef.current.isQuestionActive = true;
    soloStateRef.current.timerInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(soloStateRef.current.timerInterval);
        finishSoloQuestion();
      } else {
        setGameState((prev) => (prev ? { ...prev, timeRemainingSeconds: remaining } : null));
      }
    }, 1000);
  };

  const submitSoloAnswer = (answer: any, x2Boost: boolean = false) => {
    const q = soloStateRef.current.questions[soloStateRef.current.currentQIdx];
    if (!q || soloStateRef.current.player.hasSubmitted) return;

    const timeTakenMs = Math.max(200, Date.now() - soloStateRef.current.questionStartTime);
    let isCorrect = false;

    if (q.type === 'multiple-choice') {
      isCorrect = Number(answer) === Number(q.correctAnswer);
    } else if (q.type === 'true-false') {
      if (Array.isArray(answer) && Array.isArray(q.correctAnswer)) {
        isCorrect = answer.every((val, idx) => Boolean(val) === Boolean(q.correctAnswer[idx]));
      }
    } else if (q.type === 'matching') {
      if (typeof answer === 'object' && answer !== null && typeof q.correctAnswer === 'object') {
        const keys = Object.keys(q.correctAnswer);
        isCorrect = keys.length > 0 && keys.every((k) => answer[k] === q.correctAnswer[k]);
      }
    } else if (q.type === 'fill-blank') {
      if (Array.isArray(answer) && Array.isArray(q.correctAnswer)) {
        isCorrect = answer.every(
          (val, idx) =>
            String(val || '').trim().toLowerCase() === String(q.correctAnswer[idx] || '').trim().toLowerCase()
        );
      }
    } else if (q.type === 'short-answer') {
      const userStr = String(answer || '').trim().toLowerCase().replace(/\s+/g, '');
      const correctStr = String(q.correctAnswer || '').trim().toLowerCase().replace(/\s+/g, '');
      const acceptable = (q.shortAnswers || []).map((s) => s.trim().toLowerCase().replace(/\s+/g, ''));
      isCorrect = userStr === correctStr || acceptable.includes(userStr);
    }

    let earnedScore = 0;
    if (isCorrect) {
      const base = q.baseScore || 100;
      let mult = timeTakenMs <= 5000 ? 2.0 : timeTakenMs <= 10000 ? 1.5 : 1.2;
      earnedScore = Math.round(base * mult);
      if (x2Boost || soloStateRef.current.player.activeSkills.x2Score) {
        earnedScore *= 2;
      }
    }

    const earnedExp = isCorrect ? q.expReward || 10 : 0;
    soloStateRef.current.player.hasSubmitted = true;
    soloStateRef.current.player.submittedAnswer = answer;
    soloStateRef.current.player.submissionTimeMs = timeTakenMs;
    soloStateRef.current.player.isCorrect = isCorrect;
    soloStateRef.current.player.earnedScore = earnedScore;
    soloStateRef.current.player.earnedExp = earnedExp;
    soloStateRef.current.player.score += earnedScore;
    soloStateRef.current.player.exp = Math.min(100, soloStateRef.current.player.exp + earnedExp);
    soloStateRef.current.player.totalTimeMs += timeTakenMs;
    if (isCorrect) soloStateRef.current.player.correctCount += 1;

    setGameState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        players: {
          ...prev.players,
          solo_player: { ...soloStateRef.current.player },
        },
      };
    });

    // Auto advance after short delay
    setTimeout(() => {
      finishSoloQuestion();
    }, 1500);
  };

  const castSoloSkill = (skillType: SkillType) => {
    const p = soloStateRef.current.player;
    if (skillType === 'x2_score' && p.exp >= 20) {
      p.exp -= 20;
      p.activeSkills.x2Score = true;
      soundManager.playSkill();
    } else if (skillType === 'blind_enemy' && p.exp >= 40) {
      p.exp -= 40;
      soundManager.playSkill();
    } else if (skillType === 'fifty_fifty' && p.exp >= 80) {
      const q = soloStateRef.current.questions[soloStateRef.current.currentQIdx];
      if (q && q.type === 'multiple-choice') {
        p.exp -= 80;
        p.activeSkills.usedFiftyFifty = true;
        soundManager.playSkill();
        const correct = Number(q.correctAnswer);
        const wrong = [0, 1, 2, 3].filter((i) => i !== correct).slice(0, 2);
        setEliminatedOptionIndices(wrong);
      }
    }

    setGameState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        players: {
          ...prev.players,
          solo_player: { ...p },
        },
      };
    });
  };

  const finishSoloQuestion = () => {
    if (!soloStateRef.current.isQuestionActive) return;
    soloStateRef.current.isQuestionActive = false;
    if (soloStateRef.current.timerInterval) clearInterval(soloStateRef.current.timerInterval);

    const q = soloStateRef.current.questions[soloStateRef.current.currentQIdx];
    if (!q) return;

    const allPlayers = [soloStateRef.current.player, ...soloStateRef.current.botPlayers];
    const sorted = [...allPlayers].sort((a, b) => b.score - a.score);

    setGameState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        status: 'QUESTION_INTERMISSION',
        lastQuestionResult: {
          question: q,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          topPerformers: sorted.map((p) => ({
            playerId: p.id,
            name: p.name,
            score: p.score,
            gain: p.earnedScore || 0,
            isCorrect: Boolean(p.isCorrect),
          })),
        },
      };
    });

    // 5 seconds intermission before next question
    if (soloStateRef.current.intermissionTimer) clearTimeout(soloStateRef.current.intermissionTimer);
    soloStateRef.current.intermissionTimer = setTimeout(() => {
      advanceSoloQuestion();
    }, 5000);
  };

  const advanceSoloQuestion = () => {
    if (soloStateRef.current.intermissionTimer) clearTimeout(soloStateRef.current.intermissionTimer);
    soloStateRef.current.isQuestionActive = false;
    soloStateRef.current.currentQIdx += 1;
    if (soloStateRef.current.currentQIdx >= soloStateRef.current.questions.length) {
      endSoloGame();
      return;
    }

    const currentStation = gameState?.currentStation || 1;
    const nextQ = soloStateRef.current.questions[soloStateRef.current.currentQIdx];

    if (nextQ.station !== currentStation) {
      startSoloStationIntro(nextQ.station);
    } else {
      startSoloQuestion();
    }
  };

  const endSoloGame = () => {
    if (soloStateRef.current.timerInterval) clearInterval(soloStateRef.current.timerInterval);
    if (soloStateRef.current.stationIntroTimer) clearInterval(soloStateRef.current.stationIntroTimer);

    setGameState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        status: 'FINAL_RESULT',
      };
    });
  };

  const myPlayer = gameState?.players && myPlayerId ? gameState.players[myPlayerId] : null;

  return {
    isConnected,
    isSoloMode,
    isHost,
    roomCode,
    myPlayerId,
    myPlayer,
    gameState,
    errorMsg,
    eliminatedOptionIndices,
    createRoom,
    joinRoom,
    startGame,
    skipStationIntro,
    submitAnswer,
    castSkill,
    hostForceNext,
    resetGame,
    leaveRoom,
    initSoloMode,
  };
}
