export type StationId = 1 | 2 | 3;

export type QuestionType =
  | 'multiple-choice'
  | 'true-false'
  | 'matching'
  | 'fill-blank'
  | 'short-answer';

export interface TrueFalseItem {
  id: string;
  statement: string;
  isCorrect: boolean;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface Question {
  id: string;
  station: StationId;
  difficulty: 1 | 2 | 3;
  questionText: string;
  type: QuestionType;
  options?: string[]; // 4 choices for multiple-choice
  correctAnswer?: any; // index (0..3), or array of booleans, or matching map, or string
  trueFalseItems?: TrueFalseItem[]; // 4 items for true-false
  matchingPairs?: MatchingPair[]; // 4 pairs for matching
  blankTemplate?: string; // Text with {blank1}, {blank2}
  blankAnswers?: string[]; // Correct values
  bankChoices?: string[]; // Available tokens to fill
  shortAnswers?: string[]; // Acceptable string representations
  explanation: string;
  baseScore: number;
  expReward: number;
  timeLimit: number; // in seconds (30s or 45s)
  mediaUrl?: string;
}

export type SkillType = 'x2_score' | 'blind_enemy' | 'fifty_fifty';

export interface SkillDefinition {
  type: SkillType;
  name: string;
  costExp: number;
  description: string;
  iconName: string;
  color: string;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  score: number;
  exp: number; // 0..100
  correctCount: number;
  totalTimeMs: number;
  hasSubmitted: boolean;
  submittedAnswer?: any;
  submissionTimeMs?: number;
  isCorrect?: boolean;
  earnedScore?: number;
  earnedExp?: number;
  activeSkills: {
    x2Score?: boolean;
    isBlindedUntil?: number; // timestamp until when screen is frosted
    usedFiftyFifty?: boolean;
  };
}

export type GameStatus =
  | 'LOBBY'
  | 'STATION_INTRO'
  | 'QUESTION_ACTIVE'
  | 'QUESTION_INTERMISSION'
  | 'FINAL_RESULT';

export interface GameState {
  roomCode: string;
  status: GameStatus;
  currentStation: StationId;
  currentQuestionIndex: number;
  questions: Question[];
  totalQuestions: number;
  stationIntroTimeRemaining: number;
  questionStartTime: number;
  timeLimitSeconds: number;
  timeRemainingSeconds: number;
  allSubmitted: boolean;
  round3LockedBy?: {
    playerId: string;
    playerName: string;
    answer: string;
    timeTakenMs: number;
  } | null;
  players: Record<string, Player>;
  questionHistory?: QuestionResultItem[];
  lastQuestionResult?: {
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
}

export interface QuestionSubmission {
  playerId: string;
  playerName: string;
  avatar: string;
  answer: any;
  isCorrect: boolean;
  earnedScore: number;
  timeTakenMs: number;
}

export interface QuestionResultItem {
  questionIndex: number;
  question: Question;
  correctAnswer: any;
  explanation: string;
  submissions: QuestionSubmission[];
}

export interface StationRule {
  id: StationId;
  name: string;
  subtitle: string;
  difficultyStars: string;
  badgeColor: string;
  description: string;
  formatDetails: string[];
  durationInfo: string;
  specialRule?: string;
}
