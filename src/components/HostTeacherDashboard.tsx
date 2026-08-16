import React, { useState, useMemo } from 'react';
import { GameState, Player, QuestionResultItem } from '../types';
import {
  Shield,
  FastForward,
  CheckCircle2,
  Check,
  Users,
  Trophy,
  BarChart3,
  Clock,
  Download,
  Search,
  RefreshCw,
  XCircle,
  Award,
  Sparkles,
  ChevronRight,
  FileSpreadsheet,
  Zap,
  Flame,
  AlertCircle,
  Maximize2,
  Eye,
  CheckCheck,
} from 'lucide-react';
import { soundManager } from '../utils/audio';
import * as XLSX from 'xlsx';

interface HostTeacherDashboardProps {
  gameState: GameState;
  myPlayerId: string;
  onForceNext: () => void;
  onSkipIntro?: () => void;
  onResetGame?: () => void;
}

export const HostTeacherDashboard: React.FC<HostTeacherDashboardProps> = ({
  gameState,
  myPlayerId,
  onForceNext,
  onSkipIntro,
  onResetGame,
}) => {
  const [activeTab, setActiveTab] = useState<'live' | 'leaderboard' | 'history'>('live');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'thinking' | 'correct' | 'wrong'>('all');
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // All student players (excluding host)
  const playersList = useMemo(() => {
    return (Object.values(gameState.players || {}) as Player[]).filter((p) => !p.isHost);
  }, [gameState.players]);

  // Ranked students (Highest score to Lowest)
  const rankedPlayers = useMemo(() => {
    return [...playersList].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.streak || 0) !== (a.streak || 0)) return (b.streak || 0) - (a.streak || 0);
      return a.name.localeCompare(b.name);
    });
  }, [playersList]);

  // Submission statistics
  const submittedCount = playersList.filter((p) => p.hasSubmitted).length;
  const allSubmitted = playersList.length > 0 && submittedCount === playersList.length;
  const submissionRate = playersList.length > 0 ? Math.round((submittedCount / playersList.length) * 100) : 0;

  // Active question info
  const currentQ =
    gameState.questions && gameState.currentQuestionIndex !== undefined
      ? gameState.questions[gameState.currentQuestionIndex]
      : null;

  // Question history records
  const questionHistory: QuestionResultItem[] = gameState.questionHistory || [];

  // Filtered players for live view
  const filteredPlayers = useMemo(() => {
    return playersList.filter((p) => {
      const matchName = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchName) return false;

      if (statusFilter === 'submitted') return p.hasSubmitted;
      if (statusFilter === 'thinking') return !p.hasSubmitted;

      if (statusFilter === 'correct') {
        const lastResult = gameState.lastQuestionResult?.playerResults?.find((r) => r.playerId === p.id);
        return lastResult?.isCorrect === true;
      }
      if (statusFilter === 'wrong') {
        const lastResult = gameState.lastQuestionResult?.playerResults?.find((r) => r.playerId === p.id);
        return lastResult?.isCorrect === false;
      }
      return true;
    });
  }, [playersList, searchTerm, statusFilter, gameState.lastQuestionResult]);

  // Live Answer Choice Distribution for Active Question (MC, TF, Short-answer)
  const choiceDistribution = useMemo(() => {
    if (!currentQ || gameState.status !== 'QUESTION_ACTIVE') return null;

    if (currentQ.type === 'multiple-choice') {
      const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
      // Count submitted answers if visible
      playersList.forEach((p) => {
        if (p.hasSubmitted && p.lastAnswer !== undefined && p.lastAnswer !== null) {
          const optIdx = Number(p.lastAnswer);
          if (counts[optIdx] !== undefined) counts[optIdx]++;
        }
      });
      return { type: 'mc', counts };
    }
    return null;
  }, [currentQ, gameState.status, playersList]);

  // Selected student for transcript inspect modal
  const inspectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return playersList.find((p) => p.id === selectedStudentId) || null;
  }, [selectedStudentId, playersList]);

  // Export Full Game Results to Excel
  const handleExportExcel = () => {
    soundManager.playClick();
    try {
      // 1. Leaderboard Sheet
      const leaderboardData = rankedPlayers.map((p, idx) => {
        let correctCount = 0;
        let totalAnswered = 0;

        questionHistory.forEach((qHist) => {
          const sub = qHist.submissions.find((s) => s.playerId === p.id);
          if (sub) {
            totalAnswered++;
            if (sub.isCorrect) correctCount++;
          }
        });

        const accuracy = totalAnswered > 0 ? `${Math.round((correctCount / totalAnswered) * 100)}%` : '0%';

        return {
          'Xếp hạng': idx + 1,
          'Mã thí sinh': p.id.slice(0, 6),
          'Họ và tên': p.name,
          'Tổng điểm': p.score,
          'Số câu đúng': `${correctCount}/${questionHistory.length}`,
          'Tỉ lệ chính xác': accuracy,
          'Chuỗi thắng cao nhất': p.maxStreak || p.streak || 0,
        };
      });

      // 2. Question-by-Question Detailed Submissions Sheet
      const detailedData: any[] = [];
      questionHistory.forEach((qHist, qIdx) => {
        qHist.submissions.forEach((sub) => {
          const timeSec = (sub.timeTakenMs / 1000).toFixed(1);
          detailedData.push({
            'Câu số': qIdx + 1,
            'Trạm thi': `Trạm ${qHist.question?.station ?? 1}`,
            'Nội dung câu hỏi': qHist.question?.questionText ?? '',
            'Đáp án chuẩn': String(qHist.correctAnswer),
            'Tên học sinh': sub.playerName,
            'Câu trả lời của HS': typeof sub.answer === 'object' ? JSON.stringify(sub.answer) : String(sub.answer ?? 'Chưa nộp'),
            'Kết quả': sub.isCorrect ? 'ĐÚNG' : 'SAI',
            'Điểm nhận được': sub.earnedScore,
            'Thời gian làm bài (giây)': `${timeSec}s`,
          });
        });
      });

      const wb = XLSX.utils.book_new();

      const wsLeaderboard = XLSX.utils.json_to_sheet(leaderboardData);
      XLSX.utils.book_append_sheet(wb, wsLeaderboard, 'Bảng Tổng Sắp');

      if (detailedData.length > 0) {
        const wsDetail = XLSX.utils.json_to_sheet(detailedData);
        XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi Tiết Từng Câu');
      }

      const fileName = `Ket_Qua_Thi_Dau_Phong_${gameState.roomCode || 'KhuTuTri'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err: any) {
      alert(`Không thể xuất file Excel: ${err.message}`);
    }
  };

  return (
    <div
      id="host-teacher-dashboard"
      className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-800 space-y-5 my-4 animate-in fade-in transition-all"
    >
      {/* 1. TOP HEADER & REMOTE ACTION CONTROLS */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-500/20">
            <Shield className="w-5 h-5 text-indigo-200" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-sm sm:text-base text-white tracking-wide uppercase">
                TRUNG TÂM ĐIỀU HÀNH & GIÁM SÁT CỦA GIÁO VIÊN
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[11px] font-extrabold uppercase">
                Phòng: {gameState.roomCode}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Theo dõi trực tiếp {playersList.length} thí sinh • Điểm số thời gian thực • Kết quả chi tiết từng câu
            </p>
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Skip station intro button */}
          {gameState.status === 'STATION_INTRO' && onSkipIntro && (
            <button
              onClick={() => {
                soundManager.playClick();
                onSkipIntro();
              }}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <FastForward className="w-4 h-4" />
              Bỏ qua thể lệ (Vào câu ngay)
            </button>
          )}

          {/* Force end active question */}
          {gameState.status === 'QUESTION_ACTIVE' && (
            <button
              onClick={() => {
                soundManager.playClick();
                onForceNext();
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <FastForward className="w-4 h-4" />
              Chốt điểm & Kết thúc câu
            </button>
          )}

          {/* Force next question in intermission */}
          {gameState.status === 'QUESTION_INTERMISSION' && (
            <button
              onClick={() => {
                soundManager.playClick();
                onForceNext();
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
            >
              <FastForward className="w-4 h-4" />
              Sang câu tiếp theo
            </button>
          )}

          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
            title="Xuất bảng điểm ra file Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Xuất bảng điểm</span> (.xlsx)
          </button>

          {/* Reset game button */}
          {onResetGame && (
            <button
              onClick={() => {
                if (confirm('Bạn có chắc chắn muốn thiết lập lại ván đấu từ đầu?')) {
                  soundManager.playClick();
                  onResetGame();
                }
              }}
              className="p-2 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 rounded-xl border border-slate-700 transition-all cursor-pointer"
              title="Khởi động lại ván đấu"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. MATCH STATUS BANNER */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Trạng Thái Ván Đấu</p>
          <div className="flex items-center gap-1.5 mt-1 font-bold text-sm text-indigo-300">
            {gameState.status === 'QUESTION_ACTIVE' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span>Đang làm bài ({gameState.timeRemainingSeconds}s)</span>
              </>
            ) : gameState.status === 'QUESTION_INTERMISSION' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span>Nghỉ giữa hiệp</span>
              </>
            ) : gameState.status === 'STATION_INTRO' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                <span>Phổ biến thể lệ Trạm {gameState.currentStation}</span>
              </>
            ) : gameState.status === 'FINAL_RESULT' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                <span>Tổng kết ván đấu</span>
              </>
            ) : (
              <span>Phòng chờ</span>
            )}
          </div>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Trạm & Câu Hỏi</p>
          <p className="mt-1 font-bold text-sm text-white flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-md text-xs font-black ${
                gameState.currentStation === 1
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : gameState.currentStation === 2
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              Trạm {gameState.currentStation}
            </span>
            <span className="text-slate-300">
              Câu {(gameState.currentQuestionIndex ?? 0) + 1} / {gameState.totalQuestions || 10}
            </span>
          </p>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Tiến Độ Nộp Bài</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-bold text-sm text-emerald-400 font-mono">
              {submittedCount} / {playersList.length} thí sinh
            </span>
            <span className="text-xs font-bold text-slate-400">{submissionRate}%</span>
          </div>
        </div>

        <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Dẫn Đầu Hiện Tại</p>
          <p className="mt-1 font-bold text-sm text-amber-300 truncate flex items-center gap-1.5">
            {rankedPlayers[0] ? (
              <>
                <span>👑 {rankedPlayers[0].name}</span>
                <span className="text-xs text-amber-400 font-mono">({rankedPlayers[0].score}đ)</span>
              </>
            ) : (
              'Chưa có'
            )}
          </p>
        </div>
      </div>

      {/* 3. NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => {
            soundManager.playClick();
            setActiveTab('live');
          }}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'live'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Khảo Thí Trực Tiếp ({playersList.length})</span>
        </button>

        <button
          onClick={() => {
            soundManager.playClick();
            setActiveTab('leaderboard');
          }}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'leaderboard'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Bảng Tổng Sắp Xếp Hạng</span>
        </button>

        <button
          onClick={() => {
            soundManager.playClick();
            setActiveTab('history');
          }}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Kết Quả Qua Từng Câu ({questionHistory.length})</span>
        </button>
      </div>

      {/* 4. TAB CONTENT 1: LIVE PLAYER MATRIX */}
      {activeTab === 'live' && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm học sinh theo tên..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-[11px] font-bold text-slate-400 mr-1">Lọc:</span>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-950/60 text-slate-400 hover:text-white'
                }`}
              >
                Tất cả ({playersList.length})
              </button>
              <button
                onClick={() => setStatusFilter('submitted')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'submitted'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-950/60 text-emerald-400 hover:text-white'
                }`}
              >
                Đã nộp ({submittedCount})
              </button>
              <button
                onClick={() => setStatusFilter('thinking')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'thinking'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-950/60 text-amber-400 hover:text-white'
                }`}
              >
                Đang làm ({playersList.length - submittedCount})
              </button>
            </div>
          </div>

          {/* Student Matrix Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto p-1 pr-2">
            {filteredPlayers.map((p) => {
              const hasSub = p.hasSubmitted;
              const lastResult = gameState.lastQuestionResult?.playerResults?.find((r) => r.playerId === p.id);

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedStudentId(p.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group hover:border-indigo-400/80 ${
                    hasSub
                      ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-100 shadow-xs'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-2xl shrink-0 p-1.5 bg-slate-900 rounded-xl border border-slate-800">
                      {p.avatar}
                    </span>
                    <div className="overflow-hidden space-y-0.5">
                      <p className="font-bold text-xs sm:text-sm text-white truncate group-hover:text-indigo-300 transition-colors">
                        {p.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="font-mono font-bold text-amber-400">{p.score} đ</span>
                        {p.streak && p.streak > 1 ? (
                          <span className="text-orange-400 font-bold flex items-center gap-0.5">
                            <Flame className="w-3 h-3 fill-orange-400" /> {p.streak}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {hasSub ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black flex items-center gap-1 shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" /> Đã chốt
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                        <Clock className="w-3 h-3" /> Đang nghĩ
                      </span>
                    )}

                    {/* Result indicator if in Intermission */}
                    {gameState.status === 'QUESTION_INTERMISSION' && lastResult && (
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          lastResult.isCorrect ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {lastResult.isCorrect ? `+${lastResult.scoreEarned}đ` : '+0đ'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredPlayers.length === 0 && (
              <div className="col-span-full py-8 text-center text-slate-500 text-xs font-semibold">
                Không tìm thấy thí sinh nào phù hợp với bộ lọc.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. TAB CONTENT 2: LEADERBOARD SORTED HIGH TO LOW */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-4">
          {/* Top 3 Podium Cards */}
          {rankedPlayers.length >= 3 && (
            <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-2">
              {/* Rank 2 (Silver) */}
              <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-600 text-center space-y-1.5 flex flex-col justify-end">
                <span className="text-2xl sm:text-3xl">🥈</span>
                <span className="text-xl sm:text-2xl">{rankedPlayers[1]?.avatar}</span>
                <p className="font-bold text-xs sm:text-sm text-slate-200 truncate">{rankedPlayers[1]?.name}</p>
                <p className="font-mono font-black text-sm sm:text-base text-slate-300">{rankedPlayers[1]?.score} đ</p>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full w-fit mx-auto">
                  Hạng 2
                </span>
              </div>

              {/* Rank 1 (Gold) */}
              <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-b from-amber-950/70 to-slate-900 border border-amber-500/60 text-center space-y-1.5 shadow-lg shadow-amber-500/10 -translate-y-2">
                <span className="text-3xl sm:text-4xl animate-bounce">👑</span>
                <span className="text-2xl sm:text-3xl">{rankedPlayers[0]?.avatar}</span>
                <p className="font-black text-xs sm:text-base text-amber-300 truncate">{rankedPlayers[0]?.name}</p>
                <p className="font-mono font-black text-base sm:text-xl text-amber-400">{rankedPlayers[0]?.score} đ</p>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 bg-amber-500 text-slate-950 rounded-full w-fit mx-auto shadow-xs">
                  Quán Quân
                </span>
              </div>

              {/* Rank 3 (Bronze) */}
              <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-b from-orange-950/40 to-slate-900 border border-amber-700/60 text-center space-y-1.5 flex flex-col justify-end">
                <span className="text-2xl sm:text-3xl">🥉</span>
                <span className="text-xl sm:text-2xl">{rankedPlayers[2]?.avatar}</span>
                <p className="font-bold text-xs sm:text-sm text-amber-200/80 truncate">{rankedPlayers[2]?.name}</p>
                <p className="font-mono font-black text-sm sm:text-base text-amber-400/90">{rankedPlayers[2]?.score} đ</p>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-amber-800 text-amber-100 rounded-full w-fit mx-auto">
                  Hạng 3
                </span>
              </div>
            </div>
          )}

          {/* Full Ranked Table */}
          <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/60 max-h-[360px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[11px] font-black tracking-wider border-b border-slate-800 sticky top-0 backdrop-blur-md">
                <tr>
                  <th className="px-4 py-3 text-center w-12">Hạng</th>
                  <th className="px-4 py-3">Thí Sinh</th>
                  <th className="px-4 py-3 text-right">Tổng Điểm</th>
                  <th className="px-4 py-3 text-center hidden sm:table-cell">Số Câu Đúng</th>
                  <th className="px-4 py-3 text-center hidden sm:table-cell">Chuỗi Thắng</th>
                  <th className="px-4 py-3 text-center w-20">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {rankedPlayers.map((p, idx) => {
                  let correctCount = 0;
                  questionHistory.forEach((qh) => {
                    const sub = qh.submissions.find((s) => s.playerId === p.id);
                    if (sub?.isCorrect) correctCount++;
                  });

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-900/60 transition-colors ${
                        idx === 0
                          ? 'bg-amber-950/20'
                          : idx === 1
                          ? 'bg-slate-800/30'
                          : idx === 2
                          ? 'bg-orange-950/20'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center font-black">
                        {idx === 0 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 inline-flex items-center justify-center font-black text-xs">
                            1
                          </span>
                        ) : idx === 1 ? (
                          <span className="w-6 h-6 rounded-full bg-slate-400 text-slate-950 inline-flex items-center justify-center font-black text-xs">
                            2
                          </span>
                        ) : idx === 2 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-700 text-white inline-flex items-center justify-center font-black text-xs">
                            3
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono">#{idx + 1}</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{p.avatar}</span>
                          <div>
                            <p className="font-bold text-white text-xs sm:text-sm">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {p.id.slice(0, 6)}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="font-mono font-black text-sm text-emerald-400">{p.score} đ</span>
                      </td>

                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className="font-mono font-bold text-slate-300">
                          {correctCount} / {questionHistory.length || '-'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {p.streak && p.streak > 1 ? (
                          <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[11px] font-bold inline-flex items-center gap-1">
                            <Flame className="w-3 h-3 fill-orange-400" /> {p.streak}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedStudentId(p.id)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB CONTENT 3: QUESTION-BY-QUESTION HISTORICAL RESULTS */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {questionHistory.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800">
              <Clock className="w-8 h-8 mx-auto text-slate-500 animate-pulse" />
              <p className="font-bold text-sm">Chưa có câu hỏi nào kết thúc</p>
              <p className="text-xs text-slate-500">
                Lịch sử và thống kê đáp án chi tiết của từng học sinh sẽ xuất hiện sau mỗi câu hỏi.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Question Selector Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {questionHistory.map((qh, idx) => {
                  const stationNum = qh.question?.station ?? 1;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        soundManager.playClick();
                        setSelectedQuestionIndex(idx);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        selectedQuestionIndex === idx
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      Câu {idx + 1} (Trạm {stationNum})
                    </button>
                  );
                })}
              </div>

              {/* Detailed Card for Selected Question */}
              {questionHistory[selectedQuestionIndex] && (
                <div className="space-y-4 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                  {(() => {
                    const qh = questionHistory[selectedQuestionIndex];
                    const stationNum = qh.question?.station ?? 1;
                    const correctSubs = qh.submissions.filter((s) => s.isCorrect);
                    const percentCorrect =
                      qh.submissions.length > 0
                        ? Math.round((correctSubs.length / qh.submissions.length) * 100)
                        : 0;

                    return (
                      <>
                        {/* Question Header & Stats */}
                        <div className="flex items-start justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
                          <div className="space-y-1 max-w-2xl">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-black text-xs">
                                Câu {selectedQuestionIndex + 1}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                                  stationNum === 1
                                    ? 'bg-sky-500/20 text-sky-400'
                                    : stationNum === 2
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : 'bg-amber-500/20 text-amber-400'
                                }`}
                              >
                                Trạm {stationNum} • {qh.question?.type ?? ''}
                              </span>
                            </div>
                            <p className="font-bold text-sm sm:text-base text-white">{qh.question?.questionText ?? ''}</p>
                            <p className="text-xs text-emerald-400 font-bold">
                              🎯 Đáp án chuẩn: {String(qh.correctAnswer)}
                            </p>
                            {qh.explanation && (
                              <p className="text-[11px] text-slate-400 italic">💡 Giải thích: {qh.explanation}</p>
                            )}
                          </div>

                          {/* Quick Stats Pill */}
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center min-w-[100px]">
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Tỉ Lệ Trả Lời Đúng</p>
                              <p className="text-base font-mono font-black text-emerald-400">{percentCorrect}%</p>
                              <p className="text-[10px] text-slate-500">
                                ({correctSubs.length}/{qh.submissions.length} thí sinh)
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Student Submissions List for this Question */}
                        <div className="space-y-2">
                          <h4 className="font-bold text-xs text-slate-300 flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-indigo-400" />
                            <span>Bảng Chi Tiết Bài Làm Của Từng Thí Sinh:</span>
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-1">
                            {qh.submissions.map((sub) => {
                              const timeSec = (sub.timeTakenMs / 1000).toFixed(1);
                              return (
                                <div
                                  key={sub.playerId}
                                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                                    sub.isCorrect
                                      ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-200'
                                      : 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                                  }`}
                                >
                                  <div className="overflow-hidden space-y-0.5">
                                    <p className="font-bold text-xs truncate text-white">{sub.playerName}</p>
                                    <p className="text-[11px] font-mono truncate">
                                      Đã chọn:{' '}
                                      <span className="font-bold">
                                        {typeof sub.answer === 'object'
                                          ? JSON.stringify(sub.answer)
                                          : String(sub.answer ?? 'Chưa nộp')}
                                      </span>
                                    </p>
                                  </div>

                                  <div className="shrink-0 text-right">
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                        sub.isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-rose-600 text-white'
                                      }`}
                                    >
                                      {sub.isCorrect ? `+${sub.earnedScore}đ` : '+0đ'}
                                    </span>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                      {timeSec}s
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 7. STUDENT TRANSCRIPT & DETAILED PROFILE MODAL */}
      {inspectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 bg-slate-950 rounded-2xl border border-slate-800">
                  {inspectedStudent.avatar}
                </span>
                <div>
                  <h3 className="font-black text-base text-white">{inspectedStudent.name}</h3>
                  <p className="text-xs text-amber-400 font-mono font-bold">
                    Tổng điểm: {inspectedStudent.score} đ • Chuỗi thắng: {inspectedStudent.streak || 0}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedStudentId(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Transcript of Questions */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                Nhật ký làm bài từng câu:
              </h4>

              {questionHistory.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">Chưa có dữ liệu câu hỏi hoàn thành.</p>
              ) : (
                questionHistory.map((qh, idx) => {
                  const sub = qh.submissions.find((s) => s.playerId === inspectedStudent.id);
                  const timeSec = sub ? (sub.timeTakenMs / 1000).toFixed(1) : '0.0';

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                        sub?.isCorrect
                          ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-200'
                          : 'bg-rose-950/30 border-rose-800/40 text-rose-200'
                      }`}
                    >
                      <div className="space-y-0.5 overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white">Câu {idx + 1}</span>
                          <span className="text-[10px] text-slate-400">(Trạm {qh.question?.station ?? 1})</span>
                        </div>
                        <p className="text-[11px] truncate text-slate-300">
                          Trả lời:{' '}
                          <span className="font-bold text-white">
                            {sub ? (typeof sub.answer === 'object' ? JSON.stringify(sub.answer) : String(sub.answer)) : 'Không nộp'}
                          </span>
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            sub?.isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-rose-600 text-white'
                          }`}
                        >
                          {sub?.isCorrect ? `+${sub?.earnedScore}đ` : '+0đ'}
                        </span>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {timeSec}s
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedStudentId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
