import React, { useEffect } from 'react';
import { Question, Player } from '../types';
import { CheckCircle2, XCircle, Award, Sparkles, FastForward, Clock } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface IntermissionViewProps {
  lastResult?: {
    question: Question;
    correctAnswer: any;
    explanation: string;
    topPerformers: {
      playerId: string;
      name: string;
      score: number;
      gain: number;
      isCorrect: boolean;
    }[];
  };
  myPlayer: Player | null;
  isHost: boolean;
  onForceNext: () => void;
}

export const IntermissionView: React.FC<IntermissionViewProps> = ({
  lastResult,
  myPlayer,
  isHost,
  onForceNext,
}) => {
  const isMyAnswerCorrect = Boolean(myPlayer?.isCorrect);
  const earnedScore = myPlayer?.earnedScore || 0;
  const earnedExp = myPlayer?.earnedExp || 0;

  useEffect(() => {
    if (isMyAnswerCorrect) {
      soundManager.playCorrect();
    } else {
      soundManager.playWrong();
    }
  }, [isMyAnswerCorrect]);

  const question = lastResult?.question;

  const formatCorrectAnswer = () => {
    if (!question) return '';
    if (question.type === 'multiple-choice' && question.options) {
      const idx = Number(question.correctAnswer);
      return `${String.fromCharCode(65 + idx)}. ${question.options[idx]}`;
    }
    if (question.type === 'true-false' && question.trueFalseItems) {
      return question.trueFalseItems
        .map((it, i) => `Ý ${i + 1}: ${it.isCorrect ? 'ĐÚNG' : 'SAI'}`)
        .join(' | ');
    }
    if (question.type === 'matching') {
      return 'Xem các cặp ghép nối chuẩn trong phần giải thích bên dưới.';
    }
    if (question.type === 'fill-blank' && Array.isArray(question.correctAnswer)) {
      return question.correctAnswer.join(' ➔ ');
    }
    if (question.type === 'short-answer') {
      return String(question.correctAnswer);
    }
    return String(question.correctAnswer || '');
  };

  return (
    <div
      id="intermission-view"
      className={`max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-in zoom-in-95 ${
        !isMyAnswerCorrect && !isHost ? 'animate-shake' : ''
      }`}
    >
      {/* Result Flash Banner */}
      {!isHost && (
        <div
          className={`p-6 sm:p-8 rounded-[2rem] text-white shadow-xl flex items-center justify-between gap-4 border border-white/10 ${
            isMyAnswerCorrect
              ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700'
              : 'bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner">
              {isMyAnswerCorrect ? '🎉' : '💔'}
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black uppercase tracking-tight">
                {isMyAnswerCorrect ? 'CHÍNH XÁC Tuyệt Vời!' : 'RẤT TIẾC, Chưa Đúng!'}
              </div>
              <p className="text-xs sm:text-sm text-white/90 font-medium">
                {isMyAnswerCorrect
                  ? `Bạn nhận được +${earnedScore} điểm thưởng tốc độ và +${earnedExp} EXP!`
                  : 'Hãy đọc kỹ phần giải thích bên dưới để củng cố kiến thức và sẵn sàng câu tiếp theo!'}
              </p>
            </div>
          </div>

          {isMyAnswerCorrect && (
            <div className="hidden sm:flex flex-col items-end shrink-0">
              <span className="text-3xl font-black font-mono">+{earnedScore}</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">
                Score Bonus
              </span>
            </div>
          )}
        </div>
      )}

      {/* Answer & Explanation Card */}
      <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-black uppercase tracking-wider text-indigo-600">
            ĐÁP ÁN CHUẨN & KIẾN THỨC BÀI HỌC
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
            <Clock className="w-3.5 h-3.5" />
            Tự động chuyển câu sau 5 giây...
          </div>
        </div>

        {/* Correct Answer Highlight */}
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-black uppercase text-emerald-800 block">
              Đáp án chính xác:
            </span>
            <p className="text-sm font-bold text-emerald-950 mt-0.5">
              {formatCorrectAnswer()}
            </p>
          </div>
        </div>

        {/* Explanation */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
          <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Kiến thức cần ghi nhớ:
          </span>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
            {lastResult?.explanation || 'Không có giải thích chi tiết.'}
          </p>
        </div>
      </div>

      {/* Temporary Leaderboard (Top 5) */}
      <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
              BẢNG TỔNG SẮP TẠM THỜI (TOP 5)
            </h3>
          </div>
          {isHost && (
            <button
              onClick={() => {
                soundManager.playClick();
                onForceNext();
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <FastForward className="w-3.5 h-3.5" />
              Tiếp tục ngay
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {lastResult?.topPerformers && lastResult.topPerformers.length > 0 ? (
            lastResult.topPerformers.map((performer, idx) => (
              <div
                key={performer.playerId}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                  idx === 0
                    ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                    : 'bg-slate-50/60 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center ${
                      idx === 0
                        ? 'bg-amber-500 text-white shadow-xs'
                        : idx === 1
                        ? 'bg-slate-300 text-slate-700'
                        : idx === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-bold text-xs text-slate-800">{performer.name}</p>
                    {performer.gain > 0 && (
                      <span className="text-[10px] text-emerald-600 font-bold">
                        +{performer.gain} điểm vừa cộng
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-mono font-black text-indigo-700">
                    {performer.score} đ
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 text-center py-4">Đang đồng bộ bảng điểm...</p>
          )}
        </div>
      </div>
    </div>
  );
};
