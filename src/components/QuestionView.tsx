import React, { useState, useEffect } from 'react';
import { Question, Player, SkillType, StationId } from '../types';
import { Zap, EyeOff, Scissors, Check, Clock, AlertTriangle, Sparkles, Send, Lock, Star, Trophy, Users, Shield } from 'lucide-react';
import { SKILLS_LIST } from '../data/defaultQuestions';
import { soundManager } from '../utils/audio';

interface QuestionViewProps {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  currentStation: StationId;
  timeRemaining: number;
  timeLimit: number;
  myPlayer: Player | null;
  players: Record<string, Player>;
  isHost: boolean;
  round3LockedBy?: {
    playerId: string;
    playerName: string;
    answer: string;
    timeTakenMs: number;
  } | null;
  eliminatedOptionIndices: number[];
  onSubmitAnswer: (answer: any, x2Boost: boolean) => void;
  onCastSkill: (skillType: SkillType, targetPlayerId?: string) => void;
}

export const QuestionView: React.FC<QuestionViewProps> = ({
  question,
  questionIndex,
  totalQuestions,
  currentStation,
  timeRemaining,
  timeLimit,
  myPlayer,
  players,
  isHost,
  round3LockedBy,
  eliminatedOptionIndices,
  onSubmitAnswer,
  onCastSkill,
}) => {
  // Local state for answers
  const [selectedMcOption, setSelectedMcOption] = useState<number | null>(null);
  const [tfAnswers, setTfAnswers] = useState<Record<string, boolean | null>>({});
  const [matchingSelections, setMatchingSelections] = useState<Record<string, string>>({});
  const [activeLeftMatch, setActiveLeftMatch] = useState<string | null>(null);
  const [blankSelections, setBlankSelections] = useState<string[]>([]);
  const [shortAnswerInput, setShortAnswerInput] = useState('');
  const [useX2Boost, setUseX2Boost] = useState(false);
  const [showTargetOpponentModal, setShowTargetOpponentModal] = useState(false);

  const hasSubmitted = Boolean(myPlayer?.hasSubmitted);
  const exp = myPlayer?.exp || 0;
  const isBlinded = Boolean(myPlayer?.activeSkills.isBlindedUntil && myPlayer.activeSkills.isBlindedUntil > Date.now());

  // Reset local inputs when question changes
  useEffect(() => {
    setSelectedMcOption(null);
    setTfAnswers({});
    setMatchingSelections({});
    setActiveLeftMatch(null);
    setBlankSelections([]);
    setShortAnswerInput('');
    setUseX2Boost(false);
    setShowTargetOpponentModal(false);
  }, [question.id]);

  // Urgent sound tick during last 5 seconds
  useEffect(() => {
    if (timeRemaining <= 5 && timeRemaining > 0 && !hasSubmitted) {
      soundManager.playUrgentTick();
    } else if (timeRemaining > 0 && !hasSubmitted) {
      soundManager.playTick();
    }
  }, [timeRemaining, hasSubmitted]);

  // Submit trigger
  const handleFinalSubmit = () => {
    if (hasSubmitted || isBlinded) return;

    let payload: any = null;

    if (question.type === 'multiple-choice') {
      if (selectedMcOption === null) {
        alert('Vui lòng chọn 1 phương án đáp án!');
        return;
      }
      payload = selectedMcOption;
    } else if (question.type === 'true-false') {
      const items = question.trueFalseItems || [];
      const answersArray = items.map((it) => (tfAnswers[it.id] !== undefined ? tfAnswers[it.id] : null));
      if (answersArray.some((a) => a === null)) {
        alert('Vui lòng chọn ĐÚNG hoặc SAI cho tất cả các ý!');
        return;
      }
      payload = answersArray;
    } else if (question.type === 'matching') {
      const pairs = question.matchingPairs || [];
      if (Object.keys(matchingSelections).length < pairs.length) {
        alert('Vui lòng ghép nối đầy đủ 4 cặp!');
        return;
      }
      payload = matchingSelections;
    } else if (question.type === 'fill-blank') {
      const correctLen = question.blankAnswers?.length || 2;
      if (blankSelections.length < correctLen) {
        alert(`Vui lòng chọn đủ ${correctLen} từ khóa điền vào chỗ trống!`);
        return;
      }
      payload = blankSelections;
    } else if (question.type === 'short-answer') {
      if (!shortAnswerInput.trim()) {
        alert('Vui lòng nhập câu trả lời con số hoặc công thức!');
        return;
      }
      payload = shortAnswerInput.trim();
    }

    soundManager.playClick();
    onSubmitAnswer(payload, useX2Boost);
  };

  const handleUseSkill = (skillType: SkillType) => {
    if (skillType === 'blind_enemy') {
      setShowTargetOpponentModal(true);
    } else if (skillType === 'x2_score') {
      setUseX2Boost(true);
      onCastSkill('x2_score');
    } else if (skillType === 'fifty_fifty') {
      onCastSkill('fifty_fifty');
    }
  };

  const timePercent = Math.max(0, Math.min(100, (timeRemaining / timeLimit) * 100));
  const isUrgent = timeRemaining <= 5;

  const stationName = currentStation === 1 ? 'Khởi Động' : currentStation === 2 ? 'Đối Đầu' : 'Chinh Phục';

  // Sorted opponents for mini leaderboard
  const sortedPlayers = (Object.values(players) as Player[])
    .filter((p) => !p.isHost)
    .sort((a, b) => b.score - a.score);

  const myRank = sortedPlayers.findIndex((p) => p.id === myPlayer?.id) + 1;

  return (
    <div id="question-active-view" className="max-w-7xl mx-auto p-3 sm:p-6 animate-in fade-in relative">
      {/* Frosted Screen Blind Effect */}
      {isBlinded && (
        <div className="absolute inset-0 z-40 bg-slate-900/70 backdrop-blur-md rounded-[2rem] flex flex-col items-center justify-center p-6 text-white text-center animate-in fade-in">
          <EyeOff className="w-16 h-16 text-indigo-400 animate-bounce mb-3" />
          <h3 className="text-2xl font-black">MÀN HÌNH ĐANG BỊ ĐÓNG BĂNG!</h3>
          <p className="text-sm text-slate-200 mt-2 max-w-sm">
            Quyền năng Làm Mờ đang có tác dụng trong 5 giây. Giữ bình tĩnh để đọc câu hỏi ngay sau đó!
          </p>
        </div>
      )}

      {/* Target Opponent Modal for Blind Skill */}
      {showTargetOpponentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4">
            <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <EyeOff className="w-5 h-5 text-indigo-600" />
              Chọn 1 đối thủ để làm mờ 5 giây
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(Object.values(players) as Player[])
                .filter((p) => p.id !== myPlayer?.id && !p.isHost)
                .map((opp) => (
                  <button
                    key={opp.id}
                    onClick={() => {
                      soundManager.playClick();
                      onCastSkill('blind_enemy', opp.id);
                      setShowTargetOpponentModal(false);
                    }}
                    className="w-full p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 text-left flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{opp.avatar}</span>
                      <div>
                        <p className="font-bold text-xs text-slate-800">{opp.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{opp.score} đ</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl">
                      Chọn
                    </span>
                  </button>
                ))}
            </div>
            <button
              onClick={() => setShowTargetOpponentModal(false)}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
            >
              Hủy bỏ
            </button>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Question & Answers (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Station & Timer HUD */}
          <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {/* Station Badge */}
              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase text-white bg-indigo-600 shadow-xs">
                  Trạm {currentStation}: {stationName}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  Câu {questionIndex + 1} / {totalQuestions}
                </span>
              </div>

              {/* Countdown badge */}
              <div className="flex items-center gap-2">
                <div
                  className={`px-3.5 py-1 rounded-full font-mono font-black text-xs flex items-center gap-1.5 transition-colors ${
                    isUrgent ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{timeRemaining}s</span>
                </div>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                  +{question.baseScore} đ
                </span>
              </div>
            </div>

            {/* Live Countdown Progress Bar */}
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                  isUrgent ? 'bg-rose-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${timePercent}%` }}
              />
            </div>
          </div>

          {/* Trạm 3: Single Lockout Banner */}
          {currentStation === 3 && round3LockedBy && (
            <div className="p-4 rounded-2xl bg-amber-500 text-slate-950 font-extrabold text-sm flex items-center justify-between shadow-lg animate-in zoom-in-95">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-slate-950 animate-bounce" />
                <span>
                  <strong>{round3LockedBy.playerName}</strong> đã giành quyền trả lời đầu tiên!
                </span>
              </div>
              <span className="text-xs font-mono bg-slate-950/20 px-2 py-0.5 rounded-lg">
                {(round3LockedBy.timeTakenMs / 1000).toFixed(2)}s
              </span>
            </div>
          )}

          {/* Question Card */}
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 border-2 border-red-500 shadow-xl shadow-red-200/50 space-y-6 relative overflow-hidden transition-colors duration-500 hover:border-red-600 hover:shadow-red-300/50">
            {/* Red Accent line */}
            <div className="absolute top-0 left-0 bottom-0 w-2 bg-gradient-to-b from-red-500 to-rose-600" />

            {/* Question Text */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded">CÂU HỎI</span>
                <span>+{question.expReward || 10} EXP</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                {question.questionText}
              </h2>
            </div>

          </div>

          {/* Answer Card */}
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 border-2 border-blue-500 shadow-xl shadow-blue-200/50 space-y-6 relative overflow-hidden transition-colors duration-500 hover:border-blue-600 hover:shadow-blue-300/50">
            {/* Blue Accent line */}
            <div className="absolute top-0 left-0 bottom-0 w-2 bg-gradient-to-b from-blue-500 to-indigo-600" />
            
            <div className="text-xs font-bold text-slate-400 mb-2">
              <span className="text-blue-500 bg-blue-50 px-2 py-0.5 rounded">PHƯƠNG ÁN TRẢ LỜI</span>
            </div>

            {/* Answer Modes */}

            {/* 1. Multiple Choice */}
            {question.type === 'multiple-choice' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {(question.options || []).map((opt, idx) => {
                  const isEliminated = eliminatedOptionIndices.includes(idx);
                  const isSelected = selectedMcOption === idx;
                  const letter = String.fromCharCode(65 + idx);

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={hasSubmitted || isEliminated}
                      onClick={() => {
                        soundManager.playClick();
                        setSelectedMcOption(idx);
                      }}
                      className={`p-4 rounded-2xl border-2 text-left transition-all relative flex items-center gap-3 ${
                        isEliminated
                          ? 'opacity-30 line-through bg-slate-100 border-slate-200 cursor-not-allowed'
                          : isSelected
                          ? 'bg-blue-50 border-blue-500 shadow-md shadow-blue-100 scale-[1.02]'
                          : 'bg-white border-blue-200 hover:bg-blue-50/30 hover:border-blue-400 hover:scale-[1.01]'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-50 border border-blue-200 text-blue-700'
                        }`}
                      >
                        {letter}
                      </div>
                      <span className="text-sm font-bold text-slate-800 leading-snug">
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 2. True / False */}
            {question.type === 'true-false' && (
              <div className="space-y-3">
                {(question.trueFalseItems || []).map((item, idx) => {
                  const currentVal = tfAnswers[item.id];
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
                          {item.statement}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          disabled={hasSubmitted}
                          onClick={() => {
                            soundManager.playClick();
                            setTfAnswers((prev) => ({ ...prev, [item.id]: true }));
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                            currentVal === true
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                              : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-400'
                          }`}
                        >
                          ĐÚNG
                        </button>
                        <button
                          type="button"
                          disabled={hasSubmitted}
                          onClick={() => {
                            soundManager.playClick();
                            setTfAnswers((prev) => ({ ...prev, [item.id]: false }));
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                            currentVal === false
                              ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
                              : 'bg-white border border-slate-200 text-slate-600 hover:border-rose-400'
                          }`}
                        >
                          SAI
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. Matching */}
            {question.type === 'matching' && (
              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-500">
                  Nhấn vào 1 mục ở Cột A, sau đó nhấn mục tương ứng ở Cột B:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Column A */}
                  <div className="space-y-2">
                    <span className="text-xs font-black uppercase text-blue-700 block">
                      Cột A (Vế Trái)
                    </span>
                    {(question.matchingPairs || []).map((p) => {
                      const isSelected = activeLeftMatch === p.id;
                      const hasMatched = Boolean(matchingSelections[p.id]);

                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={hasSubmitted}
                          onClick={() => {
                            soundManager.playClick();
                            setActiveLeftMatch(p.id);
                          }}
                          className={`w-full p-3.5 rounded-2xl border-2 text-left text-xs font-bold transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-blue-50 border-blue-600 shadow-sm'
                              : hasMatched
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-300'
                          }`}
                        >
                          <span>{p.left}</span>
                          {hasMatched && (
                            <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md font-bold">
                              Đã ghép
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Column B */}
                  <div className="space-y-2">
                    <span className="text-xs font-black uppercase text-blue-700 block">
                      Cột B (Vế Phải)
                    </span>
                    {(question.matchingPairs || []).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={hasSubmitted || !activeLeftMatch}
                        onClick={() => {
                          if (activeLeftMatch) {
                            soundManager.playClick();
                            setMatchingSelections((prev) => ({
                              ...prev,
                              [activeLeftMatch]: p.right,
                            }));
                            setActiveLeftMatch(null);
                          }
                        }}
                        className="w-full p-3.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-left text-xs font-bold text-slate-700 transition-all"
                      >
                        {p.right}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Current Matches preview */}
                {Object.keys(matchingSelections).length > 0 && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Các cặp bạn đã nối:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(matchingSelections).map(([leftId, rightVal]) => {
                        const leftItem = question.matchingPairs?.find((m) => m.id === leftId);
                        return (
                          <span
                            key={leftId}
                            className="px-3 py-1 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs flex items-center gap-2"
                          >
                            <span>{leftItem?.left}</span>
                            <span className="text-indigo-600">➔</span>
                            <span>{rightVal}</span>
                            {!hasSubmitted && (
                              <button
                                onClick={() => {
                                  const next = { ...matchingSelections };
                                  delete next[leftId];
                                  setMatchingSelections(next);
                                }}
                                className="text-rose-500 font-bold hover:text-rose-700 ml-1"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. Fill-in-the-blank */}
            {question.type === 'fill-blank' && (
              <div className="space-y-4">
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-sm font-bold text-slate-800 leading-relaxed">
                  {question.blankTemplate || 'Hãy điền các từ khóa thích hợp vào chỗ trống.'}
                </div>

                {/* Selected tokens */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-500">Thứ tự từ khóa đã chọn:</span>
                  <div className="flex flex-wrap gap-2 min-h-12 p-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200 items-center">
                    {blankSelections.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">
                        (Nhấn vào các từ khóa bên dưới theo thứ tự)
                      </span>
                    ) : (
                      blankSelections.map((token, tIdx) => (
                        <span
                          key={tIdx}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
                        >
                          <span>{tIdx + 1}. {token}</span>
                          {!hasSubmitted && (
                            <button
                              onClick={() => {
                                setBlankSelections(blankSelections.filter((_, i) => i !== tIdx));
                              }}
                              className="hover:text-rose-200 font-bold ml-1"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Word Bank */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-500">Ngân hàng từ khóa:</span>
                  <div className="flex flex-wrap gap-2">
                    {(question.bankChoices || []).map((choice, cIdx) => (
                      <button
                        key={cIdx}
                        type="button"
                        disabled={hasSubmitted || blankSelections.includes(choice)}
                        onClick={() => {
                          soundManager.playClick();
                          setBlankSelections([...blankSelections, choice]);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                          blankSelections.includes(choice)
                            ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed'
                            : 'bg-white border-slate-200 text-slate-800 hover:bg-indigo-50 hover:border-indigo-300 shadow-xs'
                        }`}
                      >
                        + {choice}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 5. Short Answer */}
            {question.type === 'short-answer' && (
              <div className="space-y-4 max-w-lg mx-auto">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 text-center">
                    Nhập con số hoặc công thức hóa học:
                  </label>
                  <input
                    type="text"
                    disabled={hasSubmitted}
                    value={shortAnswerInput}
                    onChange={(e) => setShortAnswerInput(e.target.value)}
                    placeholder="VD: 1954 hoặc H2SO4 hoặc CO2..."
                    className="w-full px-4 py-3.5 text-center text-2xl font-black font-mono tracking-wider rounded-2xl border-2 border-blue-200 focus:border-blue-600 focus:outline-hidden bg-slate-50 text-slate-900 shadow-inner"
                  />
                  <p className="text-[11px] font-semibold text-emerald-600 text-center flex items-center justify-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Không phân biệt hoa / thường hay chỉ số trên / dưới (H2SO4 = H₂SO₄ = h2so4)
                  </p>
                </div>

                {/* Quick Formula Keys */}
                <div className="space-y-1.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <span className="text-[11px] font-bold text-slate-500 block text-center">
                    Bàn phím hỗ trợ nhập nhanh:
                  </span>
                  <div className="flex justify-center gap-1.5 flex-wrap">
                    {['H', 'O', 'C', 'N', 'S', 'Ca', 'Fe', 'Al', '2', '3', '4', '6', '12', '1945', '1954', 'CO2', 'H2SO4'].map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        disabled={hasSubmitted}
                        onClick={() => {
                          soundManager.playClick();
                          setShortAnswerInput((prev) => prev + sym);
                        }}
                        className="px-2.5 py-1.5 bg-white hover:bg-blue-50 hover:border-blue-300 text-slate-800 text-xs font-mono font-bold rounded-xl border border-slate-200 shadow-2xs transition-all active:scale-95"
                      >
                        {sym}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={hasSubmitted}
                      onClick={() => setShortAnswerInput((prev) => prev.slice(0, -1))}
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-xl border border-amber-200"
                    >
                      ← Xóa 1 ký tự
                    </button>
                    <button
                      type="button"
                      disabled={hasSubmitted}
                      onClick={() => setShortAnswerInput('')}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl border border-rose-200"
                    >
                      Xóa hết
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Action Bar */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-medium">
                {hasSubmitted ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    ĐÃ CHỐT ĐÁP ÁN! Đang chờ tổng hợp kết quả...
                  </span>
                ) : (
                  <span>⚡ Chốt đáp án trong 5 giây đầu để nhận thưởng 2x tốc độ!</span>
                )}
              </div>

              <button
                id="submit-answer-btn"
                type="button"
                disabled={hasSubmitted || isBlinded}
                onClick={handleFinalSubmit}
                className={`w-full sm:w-auto px-10 py-4 rounded-2xl font-black text-sm tracking-wider shadow-xl transition-all flex items-center justify-center gap-2 ${
                  hasSubmitted
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 shadow-indigo-200'
                }`}
              >
                {hasSubmitted ? (
                  <>
                    <Lock className="w-4 h-4" />
                    ĐANG CHỜ KẾT QUẢ
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    CHỐT ĐÁP ÁN
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Player Profile, EXP & Power-ups (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* User Score & EXP Card */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-200/50 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
                  {myPlayer?.avatar || '🌟'}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm leading-tight">
                    {myPlayer?.name || 'Chiến Binh'}
                  </h3>
                  <span className="text-xs text-indigo-200">
                    Hạng #{myRank > 0 ? myRank : 1} / {sortedPlayers.length}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-2xl font-black">{myPlayer?.score || 0}</span>
                <span className="text-xs text-indigo-200 block font-bold">điểm</span>
              </div>
            </div>

            {/* EXP Bar */}
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <div className="flex justify-between text-xs font-bold text-indigo-100">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  Năng lượng EXP
                </span>
                <span>{exp} / 100 EXP</span>
              </div>
              <div className="w-full h-3 bg-indigo-950/40 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, exp)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Tactical Power-ups Card */}
          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-600" />
                Quyền Năng Chiến Thuật
              </h3>
              <span className="text-[11px] font-bold text-slate-400">
                Dùng EXP
              </span>
            </div>

            <div className="space-y-2.5">
              {SKILLS_LIST.map((skill) => {
                const canAfford = exp >= skill.costExp && !hasSubmitted;
                const isActivated = skill.type === 'x2_score' && useX2Boost;

                return (
                  <div
                    key={skill.type}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isActivated
                        ? 'bg-amber-50 border-amber-400 text-amber-950'
                        : canAfford
                        ? 'bg-slate-50 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40'
                        : 'bg-slate-50/50 border-slate-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                          canAfford
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-200 text-slate-400'
                        }`}
                      >
                        {skill.type === 'x2_score' && <Zap className="w-4 h-4 fill-current" />}
                        {skill.type === 'blind_enemy' && <EyeOff className="w-4 h-4" />}
                        {skill.type === 'fifty_fifty' && <Scissors className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="font-bold text-xs text-slate-800">{skill.name}</p>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          {skill.costExp} EXP • {skill.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!canAfford || isActivated}
                      onClick={() => handleUseSkill(skill.type)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 ${
                        isActivated
                          ? 'bg-amber-400 text-slate-900 shadow-xs'
                          : canAfford
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs active:scale-95'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {isActivated ? 'ĐANG BẬT' : 'KÍCH HOẠT'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mini Live Standings */}
          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                Đang Bám Đuổi Trực Tiếp
              </h3>
              <span className="text-[10px] font-bold text-slate-400">
                {sortedPlayers.length} Thí sinh
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sortedPlayers.slice(0, 5).map((p, rankIdx) => {
                const isMe = p.id === myPlayer?.id;
                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs font-bold ${
                      isMe
                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-900'
                        : 'bg-slate-50 border border-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="font-mono text-[11px] text-slate-400 w-4">
                        #{rankIdx + 1}
                      </span>
                      <span className="text-base">{p.avatar}</span>
                      <span className="truncate">{p.name}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-slate-600">{p.score} đ</span>
                      {p.hasSubmitted && (
                        <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                          ✓
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
