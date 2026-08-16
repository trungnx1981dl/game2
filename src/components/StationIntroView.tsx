import React from 'react';
import { StationId } from '../types';
import { STATION_RULES } from '../data/defaultQuestions';
import { ShieldAlert, Clock, Sparkles } from 'lucide-react';

interface StationIntroViewProps {
  stationId: StationId;
  timeRemaining: number;
}

export const StationIntroView: React.FC<StationIntroViewProps> = ({
  stationId,
  timeRemaining,
}) => {
  const station = STATION_RULES[stationId] || STATION_RULES[1];

  return (
    <div id="station-intro-view" className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 animate-in zoom-in-95 duration-300">
      {/* Big Stage Card */}
      <div className={`bg-gradient-to-br ${station.badgeColor} p-8 sm:p-12 rounded-[2rem] text-white shadow-2xl shadow-indigo-900/20 relative overflow-hidden text-center space-y-5 border border-white/10`}>
        {/* Top Badges */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className="px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-black tracking-widest uppercase shadow-xs">
            {station.name}
          </span>
          <span className="px-4 py-1.5 rounded-full bg-white/25 backdrop-blur-md text-xs font-bold flex items-center gap-1.5 shadow-xs">
            Độ khó: <span className="text-amber-300 tracking-widest">{station.difficultyStars}</span>
          </span>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white drop-shadow-md">
            {station.subtitle}
          </h2>
          <p className="text-xs sm:text-sm text-white/95 max-w-lg mx-auto font-medium leading-relaxed">
            {station.description}
          </p>
        </div>

        {/* 15-Second Mandatory Countdown Ring */}
        <div className="pt-3 flex flex-col items-center justify-center">
          <div className="relative w-28 h-28 flex items-center justify-center">
            {/* SVG Ring */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-white/20"
                strokeWidth="3.2"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-white transition-all duration-1000 ease-linear drop-shadow-md"
                strokeDasharray={`${(Math.max(0, timeRemaining) / 15) * 100}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-black text-white leading-none">
                {timeRemaining}
              </span>
              <span className="text-[10px] uppercase font-bold text-white/80 tracking-widest mt-0.5">
                giây
              </span>
            </div>
          </div>

          <div className="mt-3 px-4 py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white text-[12px] font-bold flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-300 animate-spin" />
            <span>Tự động chuyển vào phòng thi đấu khi hết 15s</span>
          </div>
        </div>
      </div>

      {/* Rules Breakdown Card */}
      <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-600" />
            Quy chế thi đấu trạm này:
          </h3>
          <span className="text-xs font-semibold text-slate-400">
            Chuẩn bị tâm lý & chiến thuật
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {station.formatDetails.map((detail, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-3 shadow-xs"
            >
              <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                {idx + 1}
              </div>
              <span className="leading-snug">{detail}</span>
            </div>
          ))}
        </div>

        {station.specialRule && (
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs font-bold flex items-center gap-2.5 shadow-xs">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Đặc quyền trạm: {station.specialRule}</span>
          </div>
        )}
      </div>
    </div>
  );
};
