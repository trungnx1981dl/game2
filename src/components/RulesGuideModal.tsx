import React from 'react';
import { X, Zap, EyeOff, Scissors, ShieldAlert, Award, Clock, Star } from 'lucide-react';
import { STATION_RULES, SKILLS_LIST } from '../data/defaultQuestions';

interface RulesGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesGuideModal: React.FC<RulesGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div 
        id="rules-guide-modal"
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-sky-100 p-6 relative flex flex-col gap-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-400 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-sky-200">
              📜
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">CẨM NANG LUẬT ĐẤU TRƯỜNG</h2>
              <p className="text-xs text-slate-500">Quy chế 3 Trạm thi đấu & Hệ thống Quyền năng chiến thuật</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: 3 Stations Structure */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
            Cấu Trúc 3 Trạm Thi Đấu
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.values(STATION_RULES).map((station) => (
              <div
                key={station.id}
                className="bg-gradient-to-b from-slate-50 to-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                      Trạm {station.id}
                    </span>
                    <span className="text-sm font-bold text-amber-500">{station.difficultyStars}</span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">{station.name.split(':')[1]}</h4>
                  <p className="text-xs text-slate-500 mt-1">{station.subtitle}</p>
                </div>

                <div className="space-y-1 text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                  {station.formatDetails.map((f, i) => (
                    <div key={i} className="flex items-start gap-1">
                      <span className="text-sky-500 font-bold">•</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                {station.id === 3 && (
                  <div className="bg-rose-50 border border-rose-200 p-2 rounded-xl text-[11px] text-rose-700 font-medium">
                    🔥 <strong>Chế độ Duy Nhất:</strong> Ai trả lời đúng và nhanh nhất sẽ khoá câu hỏi!
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: EXP & Tactical Skills */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-pink-700 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500 fill-amber-400" />
            Hệ Thống EXP & Quyền Năng
          </h3>
          <p className="text-xs text-slate-600">
            Trả lời đúng tích lũy <strong>+10 EXP</strong> (tối đa 100 EXP). Bạn có thể dùng EXP để kích hoạt 3 quyền năng:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SKILLS_LIST.map((skill) => (
              <div
                key={skill.type}
                className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex flex-col gap-2 relative overflow-hidden"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${skill.color} text-white flex items-center justify-center font-bold text-xs shadow-xs`}>
                    {skill.type === 'x2_score' && <Zap className="w-4 h-4 fill-white" />}
                    {skill.type === 'blind_enemy' && <EyeOff className="w-4 h-4" />}
                    {skill.type === 'fifty_fifty' && <Scissors className="w-4 h-4" />}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">{skill.name}</h5>
                    <span className="text-[11px] font-bold text-amber-600">Tốn {skill.costExp} EXP</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600">{skill.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Scoring & Leaderboard Criteria */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
          <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-indigo-600" />
            Quy Tắc Tính Điểm & Xếp Hạng
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
            <div>
              <p className="font-semibold text-slate-700 mb-1">⚡ Điểm Thưởng Tốc Độ (Score):</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li>Trả lời đúng trong 5s đầu: <strong>+100% bonus (x2 điểm)</strong></li>
                <li>Trả lời đúng trong 10s đầu: <strong>+50% bonus (x1.5 điểm)</strong></li>
                <li>Trả lời sai: <strong>0 điểm</strong></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-700 mb-1">🏆 Thứ Tự Xếp Hạng Tổng Sắp:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                <li><strong>Tổng SCORE</strong> (Ưu tiên số 1)</li>
                <li><strong>Tổng số câu trả lời đúng</strong> (Ưu tiên số 2)</li>
                <li><strong>Tổng thời gian hoàn thành</strong> (Ít hơn xếp trên)</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Close button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold text-sm rounded-2xl shadow-md shadow-sky-200 hover:brightness-110 active:scale-95 transition-all"
          >
            Đã Hiểu, Sẵn Sàng Chiến Đấu!
          </button>
        </div>
      </div>
    </div>
  );
};
