import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { DEFAULT_QUESTIONS } from './src/data/defaultQuestions.ts';
import { Question, Player, GameState, GameStatus, StationId } from './src/types.ts';

const PORT = 3000;

interface ClientSocket extends WebSocket {
  id?: string;
  roomCode?: string;
  isAlive?: boolean;
}

interface ServerRoom {
  code: string;
  hostId: string;
  status: GameStatus;
  currentStation: StationId;
  currentQuestionIndex: number;
  questions: Question[];
  questionStartTime: number;
  timeLimitSeconds: number;
  stationIntroTimer?: NodeJS.Timeout;
  questionTimer?: NodeJS.Timeout;
  intermissionTimer?: NodeJS.Timeout;
  finishTimeout?: NodeJS.Timeout;
  stationIntroRemaining: number;
  round3LockedBy: {
    playerId: string;
    playerName: string;
    answer: string;
    timeTakenMs: number;
  } | null;
  players: Record<string, Player>;
  questionHistory?: any[];
  lastQuestionResult?: any;
}

const rooms: Record<string, ServerRoom> = {};
const clientMap = new Map<string, ClientSocket>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms[code] ? generateRoomCode() : code;
}

function broadcastToRoom(roomCode: string, message: any) {
  const payload = JSON.stringify(message);
  clientMap.forEach((ws) => {
    if (ws.roomCode === roomCode && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

function getSanitizedQuestion(q: Question) {
  // Return question without raw answer for client security
  const { correctAnswer, ...rest } = q;
  return rest;
}

function normalizeFormulaOrNumber(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '';
  let s = String(input).trim();

  // Map Unicode Subscripts
  const subscriptMap: Record<string, string> = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
    '₊': '+', '₋': '-',
  };
  // Map Unicode Superscripts
  const superscriptMap: Record<string, string> = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
    '⁺': '+', '⁻': '-',
  };

  for (const [sub, char] of Object.entries(subscriptMap)) {
    s = s.split(sub).join(char);
  }
  for (const [sup, char] of Object.entries(superscriptMap)) {
    s = s.split(sup).join(char);
  }

  // Remove spaces, dashes, commas, dots
  s = s.replace(/[\s\-_.,;:]/g, '');
  return s.toLowerCase();
}

function checkShortAnswer(
  userAnswer: string | number | undefined | null,
  correctAnswer: string | number | undefined | null,
  acceptableAnswers?: string[]
): boolean {
  const normUser = normalizeFormulaOrNumber(userAnswer);
  if (!normUser) return false;

  const normCorrect = normalizeFormulaOrNumber(correctAnswer);
  if (normUser === normCorrect) return true;

  if (acceptableAnswers && Array.isArray(acceptableAnswers)) {
    for (const alt of acceptableAnswers) {
      if (normalizeFormulaOrNumber(alt) === normUser) {
        return true;
      }
    }
  }

  const stripPrefix = (val: string | number | undefined | null) => {
    return String(val || '')
      .replace(/^(năm|nam|số|so)\s*/i, '')
      .trim()
      .toLowerCase()
      .replace(/[\s\-_.,;:]/g, '');
  };

  if (stripPrefix(userAnswer) === stripPrefix(correctAnswer)) return true;

  if (acceptableAnswers && Array.isArray(acceptableAnswers)) {
    for (const alt of acceptableAnswers) {
      if (stripPrefix(alt) === stripPrefix(userAnswer)) {
        return true;
      }
    }
  }

  return false;
}

function calculateScore(question: Question, answer: any, timeTakenMs: number, x2Boost: boolean = false) {
  let isCorrect = false;

  if (question.type === 'multiple-choice') {
    isCorrect = Number(answer) === Number(question.correctAnswer);
  } else if (question.type === 'true-false') {
    if (Array.isArray(answer) && Array.isArray(question.correctAnswer)) {
      isCorrect = answer.every((val, idx) => Boolean(val) === Boolean(question.correctAnswer[idx]));
    }
  } else if (question.type === 'matching') {
    if (typeof answer === 'object' && answer !== null && typeof question.correctAnswer === 'object') {
      const keys = Object.keys(question.correctAnswer);
      isCorrect = keys.length > 0 && keys.every((k) => answer[k] === question.correctAnswer[k]);
    }
  } else if (question.type === 'fill-blank') {
    if (Array.isArray(answer) && Array.isArray(question.correctAnswer)) {
      isCorrect = answer.every(
        (val, idx) =>
          String(val || '').trim().toLowerCase() === String(question.correctAnswer[idx] || '').trim().toLowerCase()
      );
    }
  } else if (question.type === 'short-answer') {
    isCorrect = checkShortAnswer(answer, question.correctAnswer, question.shortAnswers);
  }

  let earnedScore = 0;
  let earnedExp = 0;

  if (isCorrect) {
    const base = question.baseScore || 100;
    let bonusMultiplier = 1;
    // Speed bonus: within 5s (+100%), within 10s (+50%)
    if (timeTakenMs <= 5000) {
      bonusMultiplier = 2.0;
    } else if (timeTakenMs <= 10000) {
      bonusMultiplier = 1.5;
    } else {
      // Linear falloff
      const fraction = Math.max(0, 1 - timeTakenMs / (question.timeLimit * 1000));
      bonusMultiplier = 1.0 + 0.3 * fraction;
    }

    earnedScore = Math.round(base * bonusMultiplier);
    if (x2Boost) {
      earnedScore *= 2;
    }
    earnedExp = question.expReward || 10;
  }

  return { isCorrect, earnedScore, earnedExp };
}

function getSortedLeaderboard(players: Record<string, Player>): Player[] {
  return Object.values(players)
    .filter((p) => !p.isHost || Object.keys(players).length === 1)
    .sort((a, b) => {
      // 1. Total Score
      if (b.score !== a.score) return b.score - a.score;
      // 2. Correct Count
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      // 3. Total Time (lower is better)
      return a.totalTimeMs - b.totalTimeMs;
    });
}

function broadcastRoomState(room: ServerRoom) {
  const currentQ = room.questions[room.currentQuestionIndex];
  const state: GameState = {
    roomCode: room.code,
    status: room.status,
    currentStation: room.currentStation,
    currentQuestionIndex: room.currentQuestionIndex,
    questions: room.status === 'LOBBY' ? room.questions : (room.questions.map(getSanitizedQuestion) as Question[]),
    totalQuestions: room.questions.length,
    stationIntroTimeRemaining: room.stationIntroRemaining,
    questionStartTime: room.questionStartTime,
    timeLimitSeconds: currentQ ? currentQ.timeLimit : 30,
    timeRemainingSeconds: currentQ
      ? Math.max(0, Math.ceil((currentQ.timeLimit * 1000 - (Date.now() - room.questionStartTime)) / 1000))
      : 0,
    allSubmitted: Object.values(room.players).every((p) => p.isHost || p.hasSubmitted),
    round3LockedBy: room.round3LockedBy,
    players: room.players,
    questionHistory: room.questionHistory || [],
    lastQuestionResult: room.lastQuestionResult,
  };

  broadcastToRoom(room.code, {
    type: 'ROOM_STATE',
    state,
    serverTime: Date.now(),
  });
}

function startStationIntro(room: ServerRoom, stationId: StationId) {
  room.currentStation = stationId;
  room.status = 'STATION_INTRO';
  room.stationIntroRemaining = 15;
  room.round3LockedBy = null;

  if (room.stationIntroTimer) clearInterval(room.stationIntroTimer);
  if (room.questionTimer) clearTimeout(room.questionTimer);
  if (room.intermissionTimer) clearTimeout(room.intermissionTimer);

  broadcastRoomState(room);

  room.stationIntroTimer = setInterval(() => {
    room.stationIntroRemaining -= 1;
    if (room.stationIntroRemaining <= 0) {
      if (room.stationIntroTimer) clearInterval(room.stationIntroTimer);
      startCurrentQuestion(room);
    } else {
      broadcastRoomState(room);
    }
  }, 1000);
}

function startCurrentQuestion(room: ServerRoom) {
  if (room.stationIntroTimer) clearInterval(room.stationIntroTimer);
  if (room.questionTimer) clearTimeout(room.questionTimer);
  if (room.intermissionTimer) clearTimeout(room.intermissionTimer);
  if (room.finishTimeout) clearTimeout(room.finishTimeout);

  const currentQ = room.questions[room.currentQuestionIndex];
  if (!currentQ) {
    endGame(room);
    return;
  }

  room.status = 'QUESTION_ACTIVE';
  room.currentStation = currentQ.station;
  room.questionStartTime = Date.now();
  room.timeLimitSeconds = currentQ.timeLimit;
  room.round3LockedBy = null;

  // Reset per-question player submission states
  Object.values(room.players).forEach((p) => {
    p.hasSubmitted = false;
    p.submittedAnswer = undefined;
    p.submissionTimeMs = undefined;
    p.isCorrect = undefined;
    p.earnedScore = undefined;
    p.earnedExp = undefined;
    p.activeSkills.x2Score = false;
    p.activeSkills.usedFiftyFifty = false;
    // Check if blinded
    if (p.activeSkills.isBlindedUntil && p.activeSkills.isBlindedUntil <= Date.now()) {
      p.activeSkills.isBlindedUntil = undefined;
    }
  });

  broadcastRoomState(room);

  // Set timeout for question expiry
  room.questionTimer = setTimeout(() => {
    onQuestionFinished(room);
  }, currentQ.timeLimit * 1000);
}

function onQuestionFinished(room: ServerRoom) {
  if (room.status !== 'QUESTION_ACTIVE') return;
  if (room.questionTimer) clearTimeout(room.questionTimer);

  const currentQ = room.questions[room.currentQuestionIndex];
  if (!currentQ) return;

  room.status = 'QUESTION_INTERMISSION';

  // Mark unsubmitted players
  Object.values(room.players).forEach((p) => {
    if (!p.isHost && !p.hasSubmitted) {
      p.hasSubmitted = true;
      p.isCorrect = false;
      p.earnedScore = 0;
      p.earnedExp = 0;
      p.totalTimeMs += currentQ.timeLimit * 1000;
    }
  });

  // Record complete question submission history for teacher analytics
  const submissions = Object.values(room.players)
    .filter((p) => !p.isHost || Object.keys(room.players).length === 1)
    .map((p) => ({
      playerId: p.id,
      playerName: p.name,
      avatar: p.avatar,
      answer: p.submittedAnswer,
      isCorrect: Boolean(p.isCorrect),
      earnedScore: p.earnedScore || 0,
      timeTakenMs: p.submissionTimeMs || currentQ.timeLimit * 1000,
    }));

  const historyItem = {
    questionIndex: room.currentQuestionIndex,
    question: currentQ,
    correctAnswer: currentQ.correctAnswer,
    explanation: currentQ.explanation,
    submissions,
  };

  room.questionHistory = room.questionHistory || [];
  const existingIdx = room.questionHistory.findIndex((h: any) => h.questionIndex === room.currentQuestionIndex);
  if (existingIdx >= 0) {
    room.questionHistory[existingIdx] = historyItem;
  } else {
    room.questionHistory.push(historyItem);
  }

  const sorted = getSortedLeaderboard(room.players);
  room.lastQuestionResult = {
    question: currentQ,
    correctAnswer: currentQ.correctAnswer,
    explanation: currentQ.explanation,
    topPerformers: sorted.slice(0, 5).map((p) => ({
      playerId: p.id,
      name: p.name,
      score: p.score,
      gain: p.earnedScore || 0,
      isCorrect: Boolean(p.isCorrect),
    })),
  };

  broadcastRoomState(room);

  // 5 seconds Intermission as requested by prompt
  room.intermissionTimer = setTimeout(() => {
    advanceToNextQuestionOrStation(room);
  }, 5000);
}

function advanceToNextQuestionOrStation(room: ServerRoom) {
  if (room.status !== 'QUESTION_INTERMISSION') return;

  if (room.status !== "QUESTION_INTERMISSION") return;
  if (room.intermissionTimer) clearTimeout(room.intermissionTimer);

  room.currentQuestionIndex += 1;
  if (room.currentQuestionIndex >= room.questions.length) {
    endGame(room);
    return;
  }

  const nextQ = room.questions[room.currentQuestionIndex];
  if (nextQ.station !== room.currentStation) {
    // New station intro!
    startStationIntro(room, nextQ.station);
  } else {
    startCurrentQuestion(room);
  }
}

function endGame(room: ServerRoom) {
  room.status = 'FINAL_RESULT';
  if (room.stationIntroTimer) clearInterval(room.stationIntroTimer);
  if (room.questionTimer) clearTimeout(room.questionTimer);
  if (room.intermissionTimer) clearTimeout(room.intermissionTimer);

  broadcastRoomState(room);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Google GenAI Helper with Host Custom API Key support and standard headers
  function getGenAI(customApiKey?: string): GoogleGenAI | null {
    const key = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;
    if (!key) {
      return null;
    }
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  // REST API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // AI Question Generation Endpoint (Gemini Pro)
  app.post('/api/gemini/generate-questions', async (req, res) => {
    try {
      const { topic, customText, model = 'gemini-3.1-pro-preview', apiKey, stationCounts } = req.body;
      const ai = getGenAI(apiKey);

      if (!ai) {
        return res.status(400).json({
          success: false,
          error: 'Chưa cấu hình API Key của Gemini. Vui lòng nhập API Key của chủ phòng hoặc thiết lập trong cài đặt.',
        });
      }

      const prompt = `Bạn là chuyên gia giáo dục và khảo thí thiết kế bộ câu hỏi cho game show tương tác "ĐẤU TRƯỜNG KHU TỰ TRỊ".
Hãy tạo một bộ câu hỏi chuẩn 3 trạm theo chủ đề: "${topic || 'Lịch sử, Địa lý & Khoa học Việt Bắc'}" ${
        customText ? `dựa trên nguồn tư liệu bài học sau: "${customText}"` : ''
      }.

CẤU TRÚC ĐỒNG NHẤT 3 TRẠM BẮT BUỘC:
- TRẠM 1 (KHỞI ĐỘNG - 10 câu hoặc số lượng phù hợp):
  + Type: 'multiple-choice'
  + Mỗi câu có 4 options [A, B, C, D] rõ ràng, correctAnswer là index số từ 0 đến 3.
  + timeLimit: 30, baseScore: 100, expReward: 10, station: 1, difficulty: 1.
- TRẠM 2 (ĐỐI ĐẦU - 4 CÂU ĐÚNG - SAI):
  + Type: 'true-false'
  + Mỗi câu BẮT BUỘC có câu dẫn (questionText) và 4 phương án/mệnh đề trả lời trong trueFalseItems: [
      { id: 'tf1', statement: 'Mệnh đề 1...', isCorrect: true/false },
      { id: 'tf2', statement: 'Mệnh đề 2...', isCorrect: true/false },
      { id: 'tf3', statement: 'Mệnh đề 3...', isCorrect: true/false },
      { id: 'tf4', statement: 'Mệnh đề 4...', isCorrect: true/false }
    ]
  + correctAnswer là mảng boolean [b1, b2, b3, b4] tương ứng 4 mệnh đề.
  + timeLimit: 45, baseScore: 200, expReward: 10, station: 2, difficulty: 2.
- TRẠM 3 (CHINH PHỤC - 4 CÂU TRẢ LỜI NGẮN):
  + Type: 'short-answer'
  + Đáp án BẮT BUỘC là CON SỐ (ví dụ: '1945', '1954', '3143') hoặc CÔNG THỨC HÓA HỌC (CTHH, ví dụ: 'H2SO4', 'CO2', 'NaCl', 'CaCO3', 'Al2(SO4)3').
  + correctAnswer: string (ví dụ: 'H2SO4' hoặc '1954')
  + shortAnswers: mảng các cách viết tương đương, ví dụ: ['H2SO4', 'H₂SO₄', 'h2so4']
  + timeLimit: 45, baseScore: 300, expReward: 10, station: 3, difficulty: 3.

Mỗi câu hỏi BẮT BUỘC có explanation (giải thích chi tiết kiến thức và bài học cần ghi nhớ), questionText (rõ ràng, sư phạm), id dạng chuỗi duy nhất.

Trả về JSON thuần túy theo cấu trúc:
{
  "questions": [ { ...các trường của từng câu hỏi... } ]
}`;

      const selectedModel = model === 'gemini-3.7-flash' ? 'gemini-3.7-flash' : 'gemini-3.1-pro-preview';

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '{}';
      let parsedData: any;
      try {
        parsedData = JSON.parse(responseText);
      } catch (e) {
        // Fallback extract JSON array/object
        const jsonMatch = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Không thể đọc định dạng JSON trả về từ mô hình Gemini Pro.');
        }
      }

      const questionsList = Array.isArray(parsedData) ? parsedData : (parsedData.questions || []);
      res.json({ success: true, questions: questionsList, modelUsed: selectedModel });
    } catch (err: any) {
      console.error('Gemini Pro generation error:', err);
      res.status(500).json({ error: err.message || 'Lỗi xử lý tạo câu hỏi với Gemini Pro' });
    }
  });

  // PDF Upload & Auto Question Recognition Endpoint (Gemini Multimodal)
  app.post('/api/gemini/parse-pdf', async (req, res) => {
    try {
      const { pdfBase64, customPrompt, targetQuestionCount, model = 'gemini-3.1-pro-preview', apiKey } = req.body;

      if (!pdfBase64) {
        return res.status(400).json({ error: 'Vui lòng cung cấp dữ liệu file PDF (base64)!' });
      }

      const ai = getGenAI(apiKey);
      if (!ai) {
        return res.status(400).json({
          success: false,
          error: 'Chưa cấu hình API Key của Gemini. Vui lòng nhập API Key tài khoản của bạn để phân tích file PDF.',
        });
      }

      // Clean base64 string
      const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');

      const prompt = `Bạn là Chuyên gia Khảo thí & AI Phân tích Đề thi xuất sắc cho chương trình "ĐẤU TRƯỜNG KHU TỰ TRỊ".

NHIỆM VỤ THÔNG MINH:
1. Đọc và quét toàn bộ tài liệu PDF đính kèm.
2. TỰ ĐỘNG PHÂN TÍCH VÀ NHẬN DIỆN CÁC PHẦN (SECTIONS) CỦA ĐỀ THI theo chuẩn khảo thí hiện đại (ví dụ Đề thi THPT / Đề kiểm tra chuẩn GDPT 2018):
   - **PHẦN I (Trắc nghiệm 4 lựa chọn A/B/C/D)**: Nhận dạng các câu hỏi trắc nghiệm truyền thống có 4 phương án A, B, C, D. Tự động chuyển đổi thành **TRẠM 1: Khởi động** (type: 'multiple-choice', station: 1, options: [A, B, C, D], correctAnswer: index 0..3, timeLimit: 30, baseScore: 100, expReward: 10).
   - **PHẦN II (Trắc nghiệm Đúng / Sai 4 ý)**: Nhận dạng các câu hỏi có 1 câu dẫn/chủ đề và 4 mệnh đề a), b), c), d) yêu cầu chọn Đúng hoặc Sai cho từng ý. Tự động chuyển đổi thành **TRẠM 2: Đối đầu** (type: 'true-false', station: 2, trueFalseItems: [{id: 'tf1', statement: 'Ý a...', isCorrect: true/false}, {id: 'tf2', statement: 'Ý b...', isCorrect: true/false}, {id: 'tf3', statement: 'Ý c...', isCorrect: true/false}, {id: 'tf4', statement: 'Ý d...', isCorrect: true/false}], correctAnswer: [b1, b2, b3, b4], timeLimit: 45, baseScore: 200, expReward: 10).
   - **PHẦN III (Trắc nghiệm Trả lời ngắn / Điền số & CTHH)**: Nhận dạng các câu hỏi yêu cầu thí sinh tính toán ra kết quả là CON SỐ hoặc CÔNG THỨC HÓA HỌC (CTHH). Tự động chuyển đổi thành **TRẠM 3: Chinh phục** (type: 'short-answer', station: 3, correctAnswer: string, shortAnswers: [các biến thể chữ hoa/thường/chỉ số], timeLimit: 45, baseScore: 300, expReward: 10).
   - Nếu tài liệu không chia rõ phần hoặc chỉ có trắc nghiệm ABCD: Hãy tự động phân tích độ khó & tính chất để phân bố thông minh các câu phù hợp vào 3 Trạm thi đấu.

3. Đếm tổng số câu hỏi trong từng phần và đếm tổng số câu hỏi tìm thấy trong toàn bộ tài liệu.
4. Trích xuất hoặc tự giải và suy luận đáp án chính xác (correctAnswer) cùng lời giải thích (explanation) chi tiết, chuẩn xác.

${customPrompt ? `YÊU CẦU ĐẶC BIỆT TỪ NGƯỜI DÙNG: "${customPrompt}"` : ''}

Trả về định dạng JSON thuần túy (không markdown, không bọc ngoài ngoài chuỗi JSON hợp lệ):
{
  "totalFound": <tổng số câu hỏi nhận dạng được trong file PDF>,
  "detectedCount": <số câu hỏi được trích xuất>,
  "summary": "<tóm tắt ngắn gọn chủ đề, môn học và cấu trúc các phần của đề thi>",
  "detectedSections": [
    "Phần I: Câu trắc nghiệm nhiều phương án lựa chọn (X câu)",
    "Phần II: Câu trắc nghiệm Đúng/Sai (Y câu)",
    "Phần III: Câu hỏi trả lời ngắn (Z câu)"
  ],
  "sectionStats": {
    "part1Count": <số câu phần 1>,
    "part2Count": <số câu phần 2>,
    "part3Count": <số câu phần 3>
  },
  "questions": [
    {
      "id": "pdf_q_1",
      "station": 1,
      "difficulty": 1,
      "type": "multiple-choice",
      "questionText": "...",
      "options": ["A...", "B...", "C...", "D..."],
      "correctAnswer": 0,
      "explanation": "...",
      "baseScore": 100,
      "expReward": 10,
      "timeLimit": 30
    }
  ]
}`;

      const selectedModel = model === 'gemini-3.7-flash' ? 'gemini-3.7-flash' : 'gemini-3.1-pro-preview';

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: cleanBase64,
            },
          },
          {
            text: prompt,
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '{}';
      let parsedData: any;
      try {
        parsedData = JSON.parse(responseText);
      } catch (e) {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Không thể đọc định dạng JSON phản hồi từ mô hình Gemini.');
        }
      }

      res.json({
        success: true,
        totalFound: parsedData.totalFound || parsedData.questions?.length || 0,
        detectedCount: parsedData.detectedCount || parsedData.questions?.length || 0,
        summary: parsedData.summary || 'Đã phân tích tài liệu PDF thành công theo các phần.',
        detectedSections: parsedData.detectedSections || [],
        sectionStats: parsedData.sectionStats || {
          part1Count: parsedData.questions?.filter((q: any) => q.station === 1).length || 0,
          part2Count: parsedData.questions?.filter((q: any) => q.station === 2).length || 0,
          part3Count: parsedData.questions?.filter((q: any) => q.station === 3).length || 0,
        },
        questions: parsedData.questions || [],
        modelUsed: selectedModel,
      });
    } catch (err: any) {
      console.error('Gemini PDF recognition error:', err);
      res.status(500).json({ error: err.message || 'Lỗi nhận dạng câu hỏi từ PDF qua Gemini Pro' });
    }
  });

  // Google Sheets / Webhook Export Proxy
  app.post('/api/webhook/google-sheets', async (req, res) => {
    try {
      const { webhookUrl, payload } = req.body;
      if (!webhookUrl) {
        return res.status(400).json({ error: 'Webhook URL is required' });
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      res.json({ success: true, response: text });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Webhook push failed' });
    }
  });

  // Create HTTP Server & WebSocket Server
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: ClientSocket) => {
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data: string) => {
      try {
        const msg = JSON.parse(data.toString());
        handleWsMessage(ws, msg);
      } catch (err) {
        console.error('WS message parse error:', err);
      }
    });

    ws.on('close', () => {
      if (ws.id && ws.roomCode && rooms[ws.roomCode]) {
        const room = rooms[ws.roomCode];
        if (room.players[ws.id]) {
          // If in lobby, we can remove player, otherwise mark disconnected
          if (room.status === 'LOBBY') {
            delete room.players[ws.id];
          }
          broadcastRoomState(room);
        }
      }
      if (ws.id) {
        clientMap.delete(ws.id);
      }
    });
  });

  function handleWsMessage(ws: ClientSocket, msg: any) {
    const { type, payload } = msg;

    switch (type) {
      case 'CREATE_ROOM': {
        const { playerName, avatar, customQuestions } = payload;
        const code = generateRoomCode();
        const playerId = 'host_' + Math.random().toString(36).substring(2, 9);

        ws.id = playerId;
        ws.roomCode = code;
        clientMap.set(playerId, ws);

        const hostPlayer: Player = {
          id: playerId,
          name: playerName || 'Giáo Viên (Host)',
          avatar: avatar || '🎓',
          isHost: true,
          isReady: true,
          score: 0,
          exp: 0,
          correctCount: 0,
          totalTimeMs: 0,
          hasSubmitted: false,
          activeSkills: {},
        };

        const roomQuestions = customQuestions && customQuestions.length > 0 ? customQuestions : DEFAULT_QUESTIONS;

        rooms[code] = {
          code,
          hostId: playerId,
          status: 'LOBBY',
          currentStation: 1,
          currentQuestionIndex: 0,
          questions: roomQuestions,
          questionStartTime: 0,
          timeLimitSeconds: 30,
          stationIntroRemaining: 15,
          round3LockedBy: null,
          players: { [playerId]: hostPlayer },
        };

        ws.send(
          JSON.stringify({
            type: 'ROOM_CREATED',
            roomCode: code,
            playerId,
          })
        );

        broadcastRoomState(rooms[code]);
        break;
      }

      case 'JOIN_ROOM': {
        const { roomCode, playerName, avatar } = payload;
        const formattedCode = String(roomCode || '').toUpperCase().trim();
        const room = rooms[formattedCode];

        if (!room) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Không tìm thấy phòng chơi này!' }));
          return;
        }

        const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
        ws.id = playerId;
        ws.roomCode = formattedCode;
        clientMap.set(playerId, ws);

        const newPlayer: Player = {
          id: playerId,
          name: playerName || `Thí sinh ${Object.keys(room.players).length}`,
          avatar: avatar || '🦁',
          isHost: false,
          isReady: true,
          score: 0,
          exp: 0,
          correctCount: 0,
          totalTimeMs: 0,
          hasSubmitted: false,
          activeSkills: {},
        };

        room.players[playerId] = newPlayer;

        ws.send(
          JSON.stringify({
            type: 'ROOM_JOINED',
            roomCode: formattedCode,
            playerId,
          })
        );

        broadcastRoomState(room);
        break;
      }

      case 'UPDATE_PLAYER_INFO': {
        const { roomCode, playerId, name, avatar } = payload;
        const room = rooms[roomCode];
        if (room && room.players[playerId]) {
          if (name) room.players[playerId].name = name;
          if (avatar) room.players[playerId].avatar = avatar;
          broadcastRoomState(room);
        }
        break;
      }

      case 'START_GAME': {
        const { roomCode, playerId } = payload;
        const room = rooms[roomCode];
        if (!room || room.hostId !== playerId) return;

        room.currentQuestionIndex = 0;
        room.questions = prepareShuffledQuestions(room.questions);
        const firstQ = room.questions[0];
        startStationIntro(room, firstQ ? firstQ.station : 1);
        break;
      }

      case 'SKIP_STATION_INTRO': {
        const { roomCode, playerId } = payload;
        const room = rooms[roomCode];
        if (!room || room.hostId !== playerId) return;

        if (room.status === 'STATION_INTRO') {
          if (room.stationIntroTimer) clearInterval(room.stationIntroTimer);
          startCurrentQuestion(room);
        }
        break;
      }

      case 'SUBMIT_ANSWER': {
        const { roomCode, playerId, answer, x2Boost } = payload;
        const room = rooms[roomCode];
        if (!room || room.status !== 'QUESTION_ACTIVE') return;

        const player = room.players[playerId];
        if (!player || player.hasSubmitted) return;

        const currentQ = room.questions[room.currentQuestionIndex];
        if (!currentQ) return;

        const timeTakenMs = Math.max(100, Date.now() - room.questionStartTime);
        const { isCorrect, earnedScore, earnedExp } = calculateScore(
          currentQ,
          answer,
          timeTakenMs,
          Boolean(x2Boost || player.activeSkills.x2Score)
        );

        player.hasSubmitted = true;
        player.submittedAnswer = answer;
        player.submissionTimeMs = timeTakenMs;
        player.isCorrect = isCorrect;
        player.earnedScore = earnedScore;
        player.earnedExp = earnedExp;
        player.score += earnedScore;
        player.exp = Math.min(100, player.exp + earnedExp);
        player.totalTimeMs += timeTakenMs;
        if (isCorrect) {
          player.correctCount += 1;
        }

        // =================== TRẠM 3: CHẾ ĐỘ DUY NHẤT (LOCKOUT) ===================
        if (currentQ.station === 3 && isCorrect && !room.round3LockedBy) {
          room.round3LockedBy = {
            playerId: player.id,
            playerName: player.name,
            answer: String(answer),
            timeTakenMs,
          };

          broadcastToRoom(room.code, {
            type: 'ROUND_3_LOCKED',
            winner: room.round3LockedBy,
          });

          if (room.finishTimeout) clearTimeout(room.finishTimeout);
          room.finishTimeout = setTimeout(() => {
            onQuestionFinished(room);
          }, 1500);
          return;
        }

        broadcastRoomState(room);

        // Check if all non-host players have submitted
        const allSubmitted = Object.values(room.players).every((p) => p.isHost || p.hasSubmitted);
        if (allSubmitted) {
          if (room.finishTimeout) clearTimeout(room.finishTimeout);
          room.finishTimeout = setTimeout(() => {
            onQuestionFinished(room);
          }, 1500);
        }
        break;
      }

      case 'CAST_SKILL': {
        const { roomCode, playerId, skillType, targetPlayerId } = payload;
        const room = rooms[roomCode];
        if (!room) return;

        const player = room.players[playerId];
        if (!player) return;

        if (skillType === 'x2_score' && player.exp >= 20) {
          player.exp -= 20;
          player.activeSkills.x2Score = true;
          ws.send(JSON.stringify({ type: 'SKILL_ACTIVATED', skillType: 'x2_score' }));
        } else if (skillType === 'blind_enemy' && player.exp >= 40) {
          player.exp -= 40;
          if (targetPlayerId && room.players[targetPlayerId]) {
            room.players[targetPlayerId].activeSkills.isBlindedUntil = Date.now() + 5000;
          }
          ws.send(JSON.stringify({ type: 'SKILL_ACTIVATED', skillType: 'blind_enemy', targetPlayerId }));
        } else if (skillType === 'fifty_fifty' && player.exp >= 80) {
          const currentQ = room.questions[room.currentQuestionIndex];
          if (currentQ && currentQ.type === 'multiple-choice' && Array.isArray(currentQ.options)) {
            player.exp -= 80;
            player.activeSkills.usedFiftyFifty = true;
            const correctIdx = Number(currentQ.correctAnswer);
            const wrongIndices = [0, 1, 2, 3].filter((idx) => idx !== correctIdx);
            // pick 2 wrong indices to eliminate
            const eliminated = wrongIndices.slice(0, 2);
            ws.send(
              JSON.stringify({
                type: 'SKILL_ACTIVATED',
                skillType: 'fifty_fifty',
                eliminatedIndices: eliminated,
              })
            );
          }
        }
        broadcastRoomState(room);
        break;
      }

      case 'HOST_FORCE_NEXT': {
        const { roomCode, playerId } = payload;
        const room = rooms[roomCode];
        if (!room || room.hostId !== playerId) return;

        if (room.status === 'QUESTION_ACTIVE') {
          onQuestionFinished(room);
        } else if (room.status === 'QUESTION_INTERMISSION') {
          advanceToNextQuestionOrStation(room);
        }
        break;
      }

      case 'LEAVE_ROOM': {
        const { roomCode, playerId } = payload;
        const room = rooms[roomCode];
        if (room && room.players[playerId]) {
          delete room.players[playerId];
          const remainingPlayerIds = Object.keys(room.players);
          if (remainingPlayerIds.length === 0) {
            if (room.stationIntroTimer) clearInterval(room.stationIntroTimer);
            if (room.questionTimer) clearTimeout(room.questionTimer);
            if (room.intermissionTimer) clearTimeout(room.intermissionTimer);
            delete rooms[roomCode];
          } else {
            if (room.hostId === playerId) {
              room.hostId = remainingPlayerIds[0];
              room.players[remainingPlayerIds[0]].isHost = true;
            }
            broadcastRoomState(room);
          }
        }
        break;
      }

      case 'RESET_GAME': {
        const { roomCode, playerId } = payload;
        const room = rooms[roomCode];
        if (!room || room.hostId !== playerId) return;

        room.status = 'LOBBY';
        room.questions = prepareShuffledQuestions(room.questions);
        room.currentQuestionIndex = 0;
        room.currentStation = 1;
        room.round3LockedBy = null;
        Object.values(room.players).forEach((p) => {
          p.score = 0;
          p.exp = 0;
          p.correctCount = 0;
          p.totalTimeMs = 0;
          p.hasSubmitted = false;
          p.activeSkills = {};
        });
        broadcastRoomState(room);
        break;
      }
    }
  }

  // Heartbeat ping interval
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws: ClientSocket) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(pingInterval);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Đấu Trường Khu Tự Trị Server running on port ${PORT}`);
  });
}

startServer();
