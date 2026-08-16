import React, { useEffect, useState } from 'react';
import { Player } from '../types';
import { Trophy, Award, Download, Send, RotateCcw, Share2, Check, ExternalLink, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { soundManager } from '../utils/audio';

interface GameOverViewProps {
  players: Record<string, Player>;
  isHost: boolean;
  onResetGame: () => void;
  onLeave: () => void;
}

export const GameOverView: React.FC<GameOverViewProps> = ({
  players,
  isHost,
  onResetGame,
  onLeave,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isPushingWebhook, setIsPushingWebhook] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [showSheetsModal, setShowSheetsModal] = useState(false);

  // Sort players by rules: 1. Score (desc), 2. Correct Count (desc), 3. Total Time (asc)
  const allPlayersList = (Object.values(players) as Player[]);
  const rankedPlayers = allPlayersList
    .filter((p) => !p.isHost || Object.keys(players).length === 1)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return a.totalTimeMs - b.totalTimeMs;
    });

  useEffect(() => {
    soundManager.playVictory();

    // Trigger confetti celebration
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
      }, 500);
    } catch (e) {
      console.warn('Confetti exception', e);
    }
  }, []);

  const handleExportCSV = () => {
    soundManager.playClick();
    const data = rankedPlayers.map((p, idx) => ({
      'Xếp Hạng': idx + 1,
      'Họ và Tên': p.name,
      'Tổng Điểm': p.score,
      'Số Câu Đúng': p.correctCount,
      'Thời Gian Hoàn Thành (giây)': (p.totalTimeMs / 1000).toFixed(1),
      'EXP Tích Lũy': p.exp,
    }));

    const csv = Papa.unparse(data);
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `KetQua_DauTruongKhuTuTri_${Date.now()}.csv`);
    a.click();
  };

  const handleExportExcel = () => {
    soundManager.playClick();
    const data = rankedPlayers.map((p, idx) => ({
      'Xếp Hạng': idx + 1,
      'Họ và Tên': p.name,
      'Tổng Điểm': p.score,
      'Số Câu Đúng': p.correctCount,
      'Thời Gian (s)': Number((p.totalTimeMs / 1000).toFixed(1)),
      'EXP': p.exp,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'KetQuaDauTruong');
    XLSX.writeFile(workbook, `DauTruong_KetQua_${Date.now()}.xlsx`);
  };

  const handlePushToGoogleSheets = async () => {
    if (!webhookUrl.trim()) {
      alert('Vui lòng nhập URL Google Apps Script Webhook!');
      return;
    }

    setIsPushingWebhook(true);
    setWebhookStatus(null);

    const payload = {
      timestamp: new Date().toISOString(),
      gameName: 'ĐẤU TRƯỜNG KHU TỰ TRỊ',
      results: rankedPlayers.map((p, idx) => ({
        rank: idx + 1,
        name: p.name,
        score: p.score,
        correctCount: p.correctCount,
        timeSeconds: Number((p.totalTimeMs / 1000).toFixed(1)),
        exp: p.exp,
      })),
    };

    try {
      const res = await fetch('/api/webhook/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl, payload }),
      });

      const resData = await res.json();
      if (resData.success) {
        setWebhookStatus('✅ Đã đồng bộ thành công dữ liệu lên Google Sheets!');
        soundManager.playCorrect();
      } else {
        setWebhookStatus(`❌ Lỗi: ${resData.error}`);
      }
    } catch (e: any) {
      setWebhookStatus(`❌ Lỗi kết nối Webhook: ${e.message}`);
    } finally {
      setIsPushingWebhook(false);
    }
  };

  const top1 = rankedPlayers[0];
  const top2 = rankedPlayers[1];
  const top3 = rankedPlayers[2];

  return (
    <div id="game-over-view" className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-in zoom-in-95">
      {/* Grand Podium Card */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 rounded-[2.5rem] p-6 sm:p-10 text-white shadow-2xl text-center relative overflow-hidden space-y-6 border border-white/10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-black tracking-widest uppercase">
          <Trophy className="w-4 h-4 text-amber-300" />
          KẾT QUẢ CHUNG CUỘC ĐẤU TRƯỜNG
        </div>

        <h2 className="text-3xl sm:text-5xl font-black tracking-tight drop-shadow-md">
          VINH DANH NHÀ VÔ ĐỊCH
        </h2>

        {/* 3-Column Podium */}
        <div className="flex items-end justify-center gap-3 sm:gap-6 pt-6 max-w-lg mx-auto">
          {/* Top 2 (Silver) */}
          {top2 && (
            <div className="flex-1 flex flex-col items-center animate-in slide-in-from-bottom duration-700">
              <div className="text-3xl mb-1">{top2.avatar}</div>
              <span className="font-bold text-xs truncate max-w-[90px]">{top2.name}</span>
              <span className="text-xs font-mono font-extrabold text-sky-200">{top2.score} đ</span>
              <div className="w-full h-24 bg-gradient-to-t from-slate-400 to-slate-200 rounded-t-2xl mt-2 flex flex-col items-center justify-center text-slate-800 font-black shadow-md">
                <span className="text-xl">🥈</span>
                <span className="text-xs uppercase font-extrabold">HẠNG 2</span>
              </div>
            </div>
          )}

          {/* Top 1 (Gold) */}
          {top1 && (
            <div className="flex-1 flex flex-col items-center animate-in slide-in-from-bottom duration-500">
              <div className="relative">
                <span className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-2xl animate-bounce">
                  👑
                </span>
                <div className="text-4xl mb-1">{top1.avatar}</div>
              </div>
              <span className="font-extrabold text-sm truncate max-w-[100px] text-yellow-200">
                {top1.name}
              </span>
              <span className="text-sm font-mono font-black text-yellow-300">{top1.score} đ</span>
              <div className="w-full h-32 bg-gradient-to-t from-amber-500 to-yellow-300 rounded-t-2xl mt-2 flex flex-col items-center justify-center text-amber-950 font-black shadow-xl ring-2 ring-yellow-200">
                <span className="text-2xl">🥇</span>
                <span className="text-xs uppercase font-black tracking-wider">VÔ ĐỊCH</span>
              </div>
            </div>
          )}

          {/* Top 3 (Bronze) */}
          {top3 && (
            <div className="flex-1 flex flex-col items-center animate-in slide-in-from-bottom duration-1000">
              <div className="text-3xl mb-1">{top3.avatar}</div>
              <span className="font-bold text-xs truncate max-w-[90px]">{top3.name}</span>
              <span className="text-xs font-mono font-extrabold text-amber-200">{top3.score} đ</span>
              <div className="w-full h-18 bg-gradient-to-t from-amber-700 to-amber-500 rounded-t-2xl mt-2 flex flex-col items-center justify-center text-amber-100 font-black shadow-md">
                <span className="text-xl">🥉</span>
                <span className="text-xs uppercase font-extrabold">HẠNG 3</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Leaderboard Table Card */}
      <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-base">BẢNG XẾP HẠNG TOÀN ĐOÀN</h3>
            <p className="text-xs text-slate-500">
              Tiêu chí xếp hạng: Tổng Điểm (1) ➔ Số câu đúng (2) ➔ Thời gian hoàn thành (3)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Xuất Excel
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Xuất CSV
            </button>
            <button
              onClick={() => setShowSheetsModal(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              Đẩy Google Sheets
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-3 rounded-l-xl">Hạng</th>
                <th className="p-3">Thí Sinh</th>
                <th className="p-3 text-center">Tổng Điểm</th>
                <th className="p-3 text-center">Số Câu Đúng</th>
                <th className="p-3 text-center">Thời Gian (s)</th>
                <th className="p-3 rounded-r-xl text-center">EXP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {rankedPlayers.map((p, idx) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-black">
                    {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{p.avatar}</span>
                      <span className="font-bold text-slate-800">{p.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center font-mono font-black text-indigo-700 text-sm">
                    {p.score} đ
                  </td>
                  <td className="p-3 text-center font-semibold text-slate-700">
                    {p.correctCount} câu
                  </td>
                  <td className="p-3 text-center font-mono text-slate-500">
                    {(p.totalTimeMs / 1000).toFixed(1)}s
                  </td>
                  <td className="p-3 text-center font-bold text-amber-600">
                    {p.exp} EXP
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Actions */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={() => {
              soundManager.playClick();
              onLeave();
            }}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all"
          >
            Về Sảnh Chờ
          </button>

          {isHost && (
            <button
              onClick={() => {
                soundManager.playClick();
                onResetGame();
              }}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              CHƠI LẠI TRẬN MỚI
            </button>
          )}
        </div>
      </div>

      {/* Google Sheets Webhook Modal */}
      {showSheetsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-600" />
                Đồng Bộ Kết Quả Vào Google Sheets
              </h4>
              <button
                onClick={() => setShowSheetsModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Nhập URL Webhook của Google Apps Script (do bạn tạo để tự động ghi kết quả vào trang tính):
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Google Apps Script Webhook URL:
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 focus:outline-hidden font-mono"
                />
              </div>

              {webhookStatus && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
                  {webhookStatus}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSheetsModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={isPushingWebhook || !webhookUrl.trim()}
                  onClick={handlePushToGoogleSheets}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isPushingWebhook ? 'Đang gửi...' : 'Gửi dữ liệu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
