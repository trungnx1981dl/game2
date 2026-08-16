import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Atom, Music, VolumeX, BookOpen, Sparkles, HelpCircle, LogOut, Copy, Check, Shield } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface NavbarProps {
  roomCode: string | null;
  isHost: boolean;
  isSoloMode: boolean;
  onOpenQuestionBank: () => void;
  onOpenRules: () => void;
  onLeaveRoom: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomCode,
  isHost,
  isSoloMode,
  onOpenQuestionBank,
  onOpenRules,
  onLeaveRoom,
}) => {
  const [isMuted, setIsMuted] = useState(soundManager.getIsMuted());
  const [copied, setCopied] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const [bgmUrl, setBgmUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (bgmUrl) URL.revokeObjectURL(bgmUrl);
      const url = URL.createObjectURL(file);
      setBgmUrl(url);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      audioRef.current.volume = 0.3;
    }
  }, [isMuted, bgmUrl]);


  const handleToggleSound = () => {
    const nextMuted = soundManager.toggleMute();
    setIsMuted(nextMuted);
    if (!nextMuted) {
      soundManager.playClick();
    }
  };

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    soundManager.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <audio ref={audioRef} src={bgmUrl || undefined} loop autoPlay />
      <header id="app-navbar" className="w-full bg-white border-b border-slate-100 sticky top-0 z-40 px-4 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3 select-none">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-base shadow-lg shadow-indigo-200 relative overflow-hidden">
              <Atom className="w-7 h-7 text-white/90 animate-[spin_8s_linear_infinite]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                  ĐẤU TRƯỜNG KHU TỰ TRỊ
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                  3 Trạm EdTech
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium hidden md:block">
                Thi đấu đối kháng đồng thời • EXP & Quyền năng chiến thuật
              </p>
            </div>
          </div>

          {/* Center Pill: Room status if in game */}
          {roomCode && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-2xl shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-xs font-semibold text-slate-500">
                {isSoloMode ? 'Chế độ:' : 'Mã PIN:'}
              </span>
              <button
                onClick={handleCopyCode}
                title="Bấm để sao chép mã phòng"
                className="flex items-center gap-1 font-mono font-black text-sm tracking-wider text-indigo-700 hover:text-indigo-900 transition-colors"
              >
                <span>{roomCode}</span>
                {!isSoloMode && (
                  copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
              {isHost && (
                <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-lg bg-amber-100 text-amber-900 border border-amber-200">
                  HOST
                </span>
              )}
            </div>
          )}

          {/* Right Action buttons */}
          <div className="flex items-center gap-2">
            {/* Rules button */}
            <button
              id="nav-rules-btn"
              onClick={() => {
                soundManager.playClick();
                onOpenRules();
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-xs"
              title="Xem luật chơi 3 trạm"
            >
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Luật chơi</span>
            </button>

            {/* Question Bank (Host / Manager) */}
            <button
              id="nav-bank-btn"
              onClick={() => {
                soundManager.playClick();
                onOpenQuestionBank();
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-xs"
              title="Quản lý ngân hàng câu hỏi & AI"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Ngân hàng đề</span>
            </button>

            
            {/* Custom Music Upload */}
            <input type="file" id="bgm-upload" accept="audio/*" className="hidden" onChange={handleFileChange} />
            <label
              htmlFor="bgm-upload"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-all shadow-xs cursor-pointer"
              title="Tải lên nhạc nền (MP3/WAV)"
            >
              <Music className="w-4 h-4" />
              <span className="hidden sm:inline">Nhạc nền</span>
            </label>

            {/* Sound Toggle */}
            <button
              id="nav-sound-toggle-btn"
              onClick={handleToggleSound}
              className={`p-2 rounded-xl border transition-all ${
                isMuted
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              }`}
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Leave room if currently in a room - ALWAYS ACCESSIBLE */}
            {roomCode && (
              <button
                id="nav-leave-btn"
                onClick={() => {
                  soundManager.playClick();
                  setShowLeaveConfirm(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all shadow-xs active:scale-95"
                title="Rời phòng / Thoát trận bất cứ lúc nào"
              >
                <LogOut className="w-4 h-4" />
                <span>Rời phòng</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Sleek Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold shrink-0">
                <LogOut className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Xác nhận rời phòng?
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {isHost 
                    ? 'Bạn là Host. Nếu rời phòng, quyền Host sẽ được bàn giao cho thí sinh khác.' 
                    : 'Bạn có thể rời phòng thi đấu bất kỳ lúc nào để trở lại màn hình sảnh.'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">Thông tin phòng hiện tại:</p>
              <p>• Mã phòng: <span className="font-mono font-bold text-indigo-700">{roomCode}</span></p>
              <p>• Chế độ: {isSoloMode ? 'Luyện tập Solo' : 'Đấu trường nhiều người'}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  soundManager.playClick();
                  setShowLeaveConfirm(false);
                }}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all"
              >
                Ở lại tiếp tục
              </button>

              <button
                onClick={() => {
                  soundManager.playClick();
                  setShowLeaveConfirm(false);
                  onLeaveRoom();
                }}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-200 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                Rời phòng ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
