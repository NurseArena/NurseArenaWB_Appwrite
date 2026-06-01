'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { databases } from '@/lib/appwrite/client';
import { Query, ID } from 'appwrite';
import { useAuthStore } from '@/store/authStore';
import type { LiveQuizEvent } from '@/types/user';
import type { QuestionWithStatus, LeaderboardEntry } from '@/types/quiz';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export function useLiveQuiz() {
  const [upcomingQuizzes, setUpcomingQuizzes] = useState<LiveQuizEvent[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<LiveQuizEvent | null>(null);
  const [questions, setQuestions] = useState<QuestionWithStatus[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemainingMs, setTimeRemainingMs] = useState(30000);
  const [marksEarned, setMarksEarned] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalLatencyMs, setTotalLatencyMs] = useState(0);
  const [joinedLate, setJoinedLate] = useState(false);
  const [canSubmit, setCanSubmit] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizState, setQuizState] = useState<'waiting' | 'active' | 'reviewing' | 'ended'>('waiting');
  const user = useAuthStore((s) => s.user);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartRef = useRef(0);

  const fetchUpcoming = useCallback(async (examId?: string) => {
    setLoading(true);
    try {
      const queries = [
        Query.equal('status', ['scheduled', 'live']),
        Query.orderAsc('starts_at'),
      ];
      if (examId) queries.push(Query.equal('exam_code', examId));

      const { documents } = await databases.listDocuments(
        DB_ID,
        'live_quiz_events',
        queries
      );
      setUpcomingQuizzes(documents as unknown as LiveQuizEvent[]);
    } catch (err) {
      console.error('Failed to fetch live quizzes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const joinQuiz = useCallback(async (quizEventId: string) => {
    if (!user) return;
    try {
      const quiz = await databases.getDocument(
        DB_ID,
        'live_quiz_events',
        quizEventId
      );
      if (!quiz) throw new Error('Quiz not found');
      setActiveQuiz(quiz as unknown as LiveQuizEvent);

      await databases.createDocument(DB_ID, 'quiz_results', ID.unique(), {
        quizEventId,
        userId: user.id,
        score: 0,
        correctCount: 0,
        joinedAtIndex: (quiz as any).current_q_index ?? 0,
        disconnectionFlag: false,
      });

      if ((quiz as any).current_q_index > 0) {
        setJoinedLate(true);
      }

      if ((quiz as any).status === 'live') {
        setQuizState('active');
        setCurrentIndex((quiz as any).current_q_index ?? 0);
      } else {
        setQuizState('waiting');
      }
    } catch (err) {
      console.error('Failed to join quiz:', err);
    }
  }, [user]);

  const submitAnswer = useCallback(async (selected: string, questionIndex: number) => {
    if (!user || !activeQuiz || !canSubmit) return;
    const q = questions[questionIndex];
    if (!q) return;

    const isCorrect = q.correctAnswers.includes(selected);
    const qMarks = q.category === 'I' ? 1 : 2;
    const marksDelta = isCorrect ? qMarks : (q.category === 'I' ? -0.25 : 0);
    const latencyMs = Math.round(performance.now() - questionStartRef.current);

    try {
      await databases.createDocument(DB_ID, 'quiz_answers', ID.unique(), {
        quizEventId: activeQuiz.id,
        userId: user.id,
        questionIndex,
        selectedOption: selected,
        isCorrect,
      });

      if (isCorrect) {
        setMarksEarned(s => s + marksDelta);
        setCorrectCount(c => c + 1);
      }
      setTotalLatencyMs(s => s + latencyMs);
    } catch (err) {
      console.error('Failed to submit answer:', err);
    }
  }, [user, activeQuiz, canSubmit, questions]);

  const fetchLeaderboard = useCallback(async (quizEventId: string) => {
    try {
      const { documents } = await databases.listDocuments(
        DB_ID,
        'quiz_results',
        [
          Query.equal('quizEventId', quizEventId),
          Query.orderDesc('score'),
          Query.orderDesc('correctCount'),
          Query.limit(10),
        ]
      );
      if (documents) {
        setLeaderboard(documents.map((r: Record<string, unknown>, i: number) => ({
          userId: r.userId as string,
          name: 'Unknown',
          avatar: undefined,
          marksEarned: r.score as number,
          percentage: 0,
          wrong: 0,
          rank: i + 1,
        })));
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  }, []);

  useEffect(() => {
    questionStartRef.current = performance.now();
  }, [currentIndex]);

  useEffect(() => {
    if (quizState === 'active' && activeQuiz) {
      const interval = setInterval(() => {
        fetchLeaderboard(activeQuiz.id);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [quizState, activeQuiz, fetchLeaderboard]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    upcomingQuizzes,
    activeQuiz,
    questions,
    currentIndex,
    timeRemainingMs,
    marksEarned,
    correctCount,
    totalLatencyMs,
    joinedLate,
    canSubmit,
    leaderboard,
    loading,
    quizState,
    fetchUpcoming,
    joinQuiz,
    submitAnswer,
    setCurrentIndex,
    setTimeRemainingMs,
    setCanSubmit,
    setQuizState,
    setQuestions,
    setJoinedLate,
  };
}
