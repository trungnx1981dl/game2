import React, { useState } from 'react';
import { Sparkles, Users, Play, Key, UserCheck, Shield, BookOpen, Compass, ArrowRight, Check } from 'lucide-react';
import { GameState, Player, Question } from '../types';
import { soundManager } from '../utils/audio';

const AVATARS = ['🎓', '🦁', '🦅', '🐯', '🦊', '🐼', '🐬', '🦄', '🚀', '⚡', '🌟', '🏆'];

interface LobbyViewProps {
  roomCode: string | null;
  myPlayerId: string | null;
  isHost: boolean;
  gameState: GameState | null;
  questions: Question[];
  onCreateRoom: (name: string, avatar: string) => void;
  onJoinRoom: (code: string, name: string, avatar: string) => void;
  onStartGame: () => void;
  onStartSolo: () => void;
  onOpenQuestionBank: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  roomCode,
  myPlayerId,
  isHost,
  gameState,
  questions,
  onCreateRoom,
  onJoinRoom,
  onStartGame,
  onStartSolo,
  onOpenQuestionBank,
}) => {
  const [activeTab, setActiveTab] = useState<'student' | 'teacher' | 'solo'>('student');
  const [playerName, setPlayerName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const playersList = gameState ? (Object.values(gameState.players) as Player[]) : [];
  const nonHostPlayers = playersList.filter((p) => !p.isHost);
  const canStart = true;

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      soundManager.playClick();
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // If already inside a room's lobby
  if (roomCode && gameState && gameState.status === 'LOBBY') {
    return (
      <div id="room-lobby-view" className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in">
        {/* Room Header Card */}
        <div className="bg-gradient-to-br from-sky-400/15 via-indigo-400/15 to-pink-400/15 p-6 sm:p-8 rounded-3xl border border-sky-150 shadow-lg text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none text-9xl">
            🏆
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-indigo-700 font-bold text-xs shadow-xs mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            PHÒNG ĐẤU TRƯỜNG ĐANG CHỜ
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
            ĐẤU TRƯỜNG KHU TỰ TRỊ
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-md mx-auto">
            Học sinh quét mã hoặc nhập mã PIN bên dưới để tham gia thi đấu đồng loạt!
          </p>

          {/* Big Room Code Box */}
          <div className="mt-5 inline-flex flex-col sm:flex-row items-center gap-3 bg-white px-6 py-4 rounded-3xl border-2 border-indigo-200 shadow-md">
            <div className="text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                MÃ PHÒNG (PIN CODE)
              </span>
              <span className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-indigo-700">
                {roomCode}
              </span>
            </div>

            <button
              onClick={handleCopyCode}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-all flex items-center gap-1.5"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Key className="w-4 h-4" />}
              {copiedCode ? 'Đã sao chép' : 'Sao chép mã'}
            </button>
          </div>
        </div>

        {/* Players Grid Section */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-md space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-base">
                Danh sách thí sinh trong phòng ({playersList.length})
              </h3>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {playersList.length < 2 ? (
                <span className="text-amber-600 font-bold">⚠️ Cần tối thiểu 2 người để mở đấu trường đồng loạt</span>
              ) : (
                <span className="text-emerald-600 font-bold">✅ Đã đủ điều kiện bắt đầu!</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-72 overflow-y-auto p-1">
            {playersList.map((player) => (
              <div
                key={player.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-center gap-3 ${
                  player.id === myPlayerId
                    ? 'bg-sky-50/80 border-sky-300 shadow-xs'
                    : 'bg-slate-50 border-slate-200/80'
                }`}
              >
                <div className="text-2xl w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-xs border border-slate-100">
                  {player.avatar}
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-1">
                    <p className="font-bold text-xs text-slate-800 truncate">{player.name}</p>
                    {player.isHost && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 font-extrabold">
                        GV
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Sẵn sàng
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Action Bar for Host vs Player */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-medium">
              Bộ đề: <strong>{questions.length} câu hỏi</strong> • Gồm 3 Trạm thi đấu
            </div>

            {isHost ? (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={onOpenQuestionBank}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-1.5"
                >
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  Đổi đề thi
                </button>
                <button
                  id="host-start-game-btn"
                  onClick={() => {
                    soundManager.playClick();
                    onStartGame();
                  }}
                  disabled={!canStart}
                  className="flex-1 sm:flex-initial px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-emerald-200 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-white" />
                  BẮT ĐẦU ĐẤU TRƯỜNG
                </button>
              </div>
            ) : (
              <div className="p-3 bg-sky-50 rounded-2xl border border-sky-150 text-xs text-sky-800 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                Đang chờ Giáo viên nhấn bắt đầu câu hỏi...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Welcome / Entrance Screen
  return (
    <div id="landing-lobby" className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-sky-400 via-indigo-500 to-pink-500 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 opacity-20 text-9xl pointer-events-none">
          🏰
        </div>

        <div className="max-w-xl space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            ĐẤU TRƯỜNG KIẾN THỨC GAME SHOW
          </div>

          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
            ĐẤU TRƯỜNG KHU TỰ TRỊ
          </h2>

          <p className="text-xs sm:text-sm text-sky-100 font-normal leading-relaxed">
            Học sinh trả lời đồng loạt, tích lũy EXP mở khóa quyền năng, tranh tài qua 3 Trạm thử thách nghẹt thở!
          </p>
        </div>
      </div>

      {/* Main Mode Selection Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-lg space-y-6">
        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('student')}
            className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'student'
                ? 'bg-white text-indigo-700 shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Vào Phòng Học Sinh
          </button>
          <button
            onClick={() => setActiveTab('teacher')}
            className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'teacher'
                ? 'bg-white text-indigo-700 shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4" />
            Giáo Viên Mở Phòng
          </button>
          <button
            onClick={() => setActiveTab('solo')}
            className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'solo'
                ? 'bg-white text-pink-600 shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Compass className="w-4 h-4" />
            Tự Khám Phá (1 Người)
          </button>
        </div>

        {/* Avatar Picker for All Modes */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">Chọn Avatar đại diện:</label>
          <div className="flex items-center gap-2 overflow-x-auto p-1.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            {AVATARS.map((av) => (
              <button
                key={av}
                type="button"
                onClick={() => {
                  setSelectedAvatar(av);
                  soundManager.playClick();
                }}
                className={`text-2xl w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                  selectedAvatar === av
                    ? 'bg-indigo-600 text-white shadow-md scale-110 ring-2 ring-indigo-300'
                    : 'bg-white hover:bg-slate-100'
                }`}
              >
                {av}
              </button>
            ))}
          </div>
        </div>

        {/* TAB 1: STUDENT JOIN */}
        {activeTab === 'student' && (
          <div className="space-y-4 max-w-md mx-auto">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mã Phòng (PIN 6 ký tự):</label>
              <input
                type="text"
                value={inputRoomCode}
                onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                placeholder="VD: ABC89Z"
                maxLength={6}
                className="w-full px-4 py-3 text-center font-mono text-2xl font-bold tracking-widest uppercase rounded-2xl border-2 border-indigo-200 focus:border-indigo-500 focus:outline-hidden bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên / Biệt danh:</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Nhập tên của bạn..."
                className="w-full px-4 py-3 text-sm font-semibold rounded-2xl border border-slate-300 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <button
              onClick={() => {
                if (!inputRoomCode.trim()) return alert('Vui lòng nhập Mã phòng!');
                if (!playerName.trim()) return alert('Vui lòng nhập tên của bạn!');
                soundManager.playClick();
                onJoinRoom(inputRoomCode, playerName, selectedAvatar);
              }}
              className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-indigo-200 hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <UserCheck className="w-5 h-5" />
              THAM GIA PHÒNG THI ĐẤU
            </button>
          </div>
        )}

        {/* TAB 2: TEACHER CREATE */}
        {activeTab === 'teacher' && (
          <div className="space-y-4 max-w-md mx-auto">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tên Giáo Viên / Host:</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Thầy / Cô (hoặc Ban Tổ Chức)..."
                className="w-full px-4 py-3 text-sm font-semibold rounded-2xl border border-slate-300 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-150 text-xs text-indigo-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-indigo-600" />
                Quyền Hạn Giáo Viên:
              </p>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 text-indigo-800">
                <li>Xem trực tiếp tiến độ học sinh (ai đang suy nghĩ, ai đã chốt).</li>
                <li>Tự động điều phối 3 Trạm câu hỏi & bảng tổng sắp realtime.</li>
                <li>Tùy biến câu hỏi hoặc sinh đề tự động bằng AI.</li>
              </ul>
            </div>

            <button
              onClick={() => {
                soundManager.playClick();
                onCreateRoom(playerName || 'Giáo Viên (Host)', selectedAvatar);
              }}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-emerald-200 hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              TẠO PHÒNG ĐẤU TRƯỜNG MỚI
            </button>
          </div>
        )}

        {/* TAB 3: SOLO DISCOVERY */}
        {activeTab === 'solo' && (
          <div className="space-y-4 max-w-md mx-auto text-center">
            <div className="p-4 bg-pink-50 rounded-2xl border border-pink-150 text-left space-y-2">
              <h4 className="font-bold text-pink-800 text-sm flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-pink-600" />
                Chế Độ Tự Khám Phá (1 Người Chơi)
              </h4>
              <p className="text-xs text-pink-700">
                Chơi ngay lập tức mà không cần tạo phòng hay chờ người khác! Bạn sẽ thi đấu cùng các đấu sĩ ảo mô phỏng, trải nghiệm trọn vẹn 3 Trạm và hệ thống Quyền năng.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 text-left">Tên của bạn:</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="VD: Nhà Thám Hiểm..."
                className="w-full px-4 py-3 text-sm font-semibold rounded-2xl border border-slate-300 focus:border-pink-500 focus:outline-hidden"
              />
            </div>

            <button
              id="start-solo-btn"
              onClick={() => {
                soundManager.playClick();
                onStartSolo();
              }}
              className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-pink-200 hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-white" />
              VÀO CHƠI TỰ KHÁM PHÁ NGAY
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
