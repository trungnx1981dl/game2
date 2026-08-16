import React, { useState } from 'react';
import { useGameClient } from './hooks/useGameClient';
import { Navbar } from './components/Navbar';
import { LobbyView } from './components/LobbyView';
import { StationIntroView } from './components/StationIntroView';
import { QuestionView } from './components/QuestionView';
import { IntermissionView } from './components/IntermissionView';
import { GameOverView } from './components/GameOverView';
import { HostTeacherDashboard } from './components/HostTeacherDashboard';
import { QuestionBankModal } from './components/QuestionBankModal';
import { RulesGuideModal } from './components/RulesGuideModal';
import { PasswordPromptModal } from './components/PasswordPromptModal';
import { soundManager } from './utils/audio';
import { DEFAULT_QUESTIONS } from './data/defaultQuestions';
import { Question } from './types';

export default function App() {
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [showQuestionBank, setShowQuestionBank] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordAction, setPasswordAction] = useState<'bank' | 'createRoom' | null>(null);
  const [pendingRoomCreate, setPendingRoomCreate] = useState<{name: string, avatar: string} | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const {
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
  } = useGameClient();

  const handleCreateRoomRequest = (name: string, avatar: string) => {
    setPendingRoomCreate({ name, avatar });
    setPasswordAction('createRoom');
    setShowPasswordModal(true);
  };

  const handleStartSolo = () => {
    initSoloMode(questions);
  };

  const handleRequestQuestionBank = () => {
    setPasswordAction('bank');
    setShowPasswordModal(true);
  };

  const handlePasswordSuccess = () => {
    setShowPasswordModal(false);
    if (passwordAction === 'bank') {
      setShowQuestionBank(true);
    } else if (passwordAction === 'createRoom' && pendingRoomCreate) {
      createRoom(pendingRoomCreate.name, pendingRoomCreate.avatar, questions);
    }
    setPasswordAction(null);
    setPendingRoomCreate(null);
  };

  
  

  const currentQ =
    gameState && gameState.questions && gameState.currentQuestionIndex !== undefined
      ? gameState.questions[gameState.currentQuestionIndex]
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-indigo-50/40 to-pink-50 text-slate-800 flex flex-col font-sans selection:bg-indigo-200">
      {/* Top Navbar */}
      <Navbar
        roomCode={roomCode}
        isHost={isHost}
        isSoloMode={isSoloMode}
        onOpenQuestionBank={handleRequestQuestionBank}
        onOpenRules={() => setShowRulesModal(true)}
        onLeaveRoom={leaveRoom}
      />

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="max-w-4xl mx-auto w-full px-4 pt-3">
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 flex flex-col justify-center">
        {/* LOBBY STATE */}
        {(!gameState || gameState.status === 'LOBBY') && (
          <LobbyView
            roomCode={roomCode}
            myPlayerId={myPlayerId}
            isHost={isHost}
            gameState={gameState}
            questions={questions}
            onCreateRoom={handleCreateRoomRequest}
            onJoinRoom={joinRoom}
            onStartGame={startGame}
            onStartSolo={handleStartSolo}
            onOpenQuestionBank={handleRequestQuestionBank}
          />
        )}

        {/* STATION INTRO STATE (15s rules countdown) */}
        {gameState && gameState.status === 'STATION_INTRO' && (
          <>
            {isHost && myPlayerId && (
              <HostTeacherDashboard
                gameState={gameState}
                myPlayerId={myPlayerId}
                onForceNext={hostForceNext}
                onSkipIntro={skipStationIntro}
                onResetGame={resetGame}
              />
            )}
            <StationIntroView
              stationId={gameState.currentStation}
              timeRemaining={gameState.stationIntroTimeRemaining}
              isHost={isHost}
              onSkip={skipStationIntro}
            />
          </>
        )}

        {/* ACTIVE QUESTION STATE */}
        {gameState && gameState.status === 'QUESTION_ACTIVE' && currentQ && (
          <>
            {/* Teacher live response matrix if Host */}
            {isHost && myPlayerId && (
              <HostTeacherDashboard
                gameState={gameState}
                myPlayerId={myPlayerId}
                onForceNext={hostForceNext}
                onSkipIntro={skipStationIntro}
                onResetGame={resetGame}
              />
            )}
            <QuestionView
              question={currentQ}
              questionIndex={gameState.currentQuestionIndex}
              totalQuestions={gameState.totalQuestions}
              currentStation={gameState.currentStation}
              timeRemaining={gameState.timeRemainingSeconds}
              timeLimit={gameState.timeLimitSeconds}
              myPlayer={myPlayer}
              players={gameState.players}
              isHost={isHost}
              round3LockedBy={gameState.round3LockedBy}
              eliminatedOptionIndices={eliminatedOptionIndices}
              onSubmitAnswer={submitAnswer}
              onCastSkill={castSkill}
            />
          </>
        )}

        {/* QUESTION INTERMISSION STATE (5s answer breakdown + leaderboard) */}
        {gameState && gameState.status === 'QUESTION_INTERMISSION' && (
          <>
            {isHost && myPlayerId && (
              <HostTeacherDashboard
                gameState={gameState}
                myPlayerId={myPlayerId}
                onForceNext={hostForceNext}
                onSkipIntro={skipStationIntro}
                onResetGame={resetGame}
              />
            )}
            <IntermissionView
              lastResult={gameState.lastQuestionResult}
              myPlayer={myPlayer}
              isHost={isHost}
              onForceNext={hostForceNext}
            />
          </>
        )}

        {/* FINAL RESULT / GAME OVER STATE */}
        {gameState && gameState.status === 'FINAL_RESULT' && (
          <GameOverView
            players={gameState.players}
            isHost={isHost}
            onResetGame={resetGame}
            onLeave={leaveRoom}
          />
        )}
      </main>

      {/* Question Bank Modal */}
      <QuestionBankModal
        isOpen={showQuestionBank}
        onClose={() => setShowQuestionBank(false)}
        questions={questions}
        onSaveQuestions={(newQuestions) => setQuestions(newQuestions)}
      />

      {/* Password Prompt Modal for Question Bank (Password: 123) */}
      <PasswordPromptModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={handlePasswordSuccess}
      />

      {/* Rules & Guide Modal */}
      <RulesGuideModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
      />

      {/* Subtle Footer */}
      <footer className="w-full text-center py-3 text-[11px] text-slate-400 font-medium border-t border-slate-200/50 bg-white/40">
        ĐẤU TRƯỜNG KHU TỰ TRỊ • Nền tảng Game Show Ôn tập Kiến thức Realtime Trực quan
      </footer>
    </div>
  );
}
