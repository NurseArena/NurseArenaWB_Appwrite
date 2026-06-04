export type QuizType = 'mock' | 'quiz' | 'topicwise' | 'rapid_fire' | 'live' | 'daily' | 'pyq';

export interface Quiz {
  id: string;
  examId: string;
  type: QuizType;
  title: string;
  startTime?: string;
  endTime?: string;
  durationSeconds: number;
  questionCount?: number;
  isAuto?: boolean;
  maxMarks?: number;
  isLiveAttempt?: boolean;
  subjectId?: string;
  topicId?: string;
  pyqYear?: number;
  perQuestionSeconds?: number;
  scoringProfileId?: string;
  liveAt?: string;
  catchupEndsAt?: string;
  liveStatus?: 'scheduled' | 'live' | 'catchup' | 'closed' | 'failed';
}

export interface QuizQuestion {
  quizId: string;
  questionId: string;
  orderIndex: number;
}

export interface Attempt {
  id: string;
  userId: string;
  questionId: string;
  selectedOption?: string;
  isCorrect?: boolean;
  timeTakenMs?: number;
  attemptedAt?: string;
}

export type QuizState = 'idle' | 'loading' | 'active' | 'reviewing' | 'finished';

export interface QuizSession {
  state: QuizState;
  questions: QuestionWithStatus[];
  currentIndex: number;
  startTime: number;
  timeRemaining: number;
  marksEarned: number;
  totalMarks: number;
  correct: number;
  wrong: number;
  skipped: number;
  negativePenalty: number;
  categoryIAttempts: { correct: number; wrong: number; skip: number };
  categoryIIAttempts: { correct: number; wrong: number; partial: number; skip: number };
  answers: Record<string, { selected: string | string[] | null; isCorrect: boolean; timeMs: number }>;
}

export interface QuestionWithStatus {
  id: string;
  question: string;
  options: { label: string; text: string }[];
  correctAnswers: string[];
  category: 'I' | 'II';
  explanation?: string;
  difficulty?: string;
  topic?: string;
  answered?: boolean;
  selected?: string | string[];
  isCorrect?: boolean;
}

export interface LiveQuizState {
  eventId: string;
  state: 'waiting' | 'active' | 'reviewing' | 'ended';
  currentQuestionIndex: number;
  currentQuestion: QuestionWithStatus | null;
  timeRemainingMs: number;
  score: number;
  correctCount: number;
  totalLatencyMs: number;
  joinedLate: boolean;
  canSubmit: boolean;
  leaderboard: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatar?: string;
  marksEarned: number;
  percentage: number;
  wrong: number;
  rank: number;
}

export interface ScoringProfile {
  id: string;
  name: string;
  marks_correct: number;
  marks_wrong: number;
  marks_unattempted: number;
  partial_credit: boolean;
}

export interface QuizSessionRecord {
  id: string;
  quizId: string;
  userId: string;
  startedAt: string;
  submittedAt?: string;
  timeTakenMs?: number;
  totalQuestions: number;
  attemptedCount: number;
  correctCount: number;
  wrongCount: number;
  score: number;
  maxScore: number;
  status: 'in_progress' | 'submitted' | 'abandoned';
  quiz?: Quiz;
}

export interface SessionAnswerRecord {
  id: string;
  sessionId: string;
  questionId: string;
  orderIndex: number;
  selectedOption?: string;
  isCorrect?: boolean;
  marksAwarded?: number;
  timeTakenMs?: number;
  answeredAt?: string;
  question?: QuestionWithStatus;
}

export interface MockTest {
  id: string;
  exam_code: string;
  title: string;
  serial_number: number;
  duration_seconds: number;
  status: 'draft' | 'published' | 'archived';
  published_at?: string;
  created_by?: string;
  created_at: string;
}

export interface MockTestAttempt {
  id: string;
  mock_test_id: string;
  userId: string;
  sessionId: string;
  startedAt: string;
  submittedAt?: string;
  score?: number;
  correctCount?: number;
  wrongCount?: number;
  rank?: number;
}

export interface MockTestQuestion {
  $id?: string;
  id?: string;
  mock_test_id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct: string;
  explanation?: string;
  order_index: number;
}

export interface MockTestTakingState {
  state: 'idle' | 'loading' | 'active' | 'reviewing' | 'finished';
  questions: MockTestQuestionWithStatus[];
  currentIndex: number;
  startTime: number;
  timeRemaining: number;
  answers: Record<string, { selected: string; isCorrect: boolean; timeMs: number }>;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
}

export interface MockTestQuestionWithStatus {
  id: string;
  question: string;
  options: { label: string; text: string }[];
  correct: string;
  explanation?: string;
  order_index: number;
  answered?: boolean;
  selected?: string;
  isCorrect?: boolean;
}

export type { Question } from './exam';
