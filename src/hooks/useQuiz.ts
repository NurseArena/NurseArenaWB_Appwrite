'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuizStore } from '@/store/quizStore';
import { useAuthStore } from '@/store/authStore';
import { databases } from '@/lib/appwrite/client';
import { Query, ID } from 'appwrite';
import { calculateMarks as calculateMarksV2 } from '@/lib/xp';
import { calculateMarks as calculateScoring, calculateSessionScore } from '@/lib/scoring';
import type { QuestionWithStatus, ScoringProfile } from '@/types/quiz';
import { upsertLeaderboardEntries } from '@/services/leaderboard';
import { checkAndUpdateStreak } from '@/services/profiles';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export function useQuiz() {
  const user = useAuthStore((s) => s.user);

  // Stable action selectors — these never change between renders
  const setState = useQuizStore((s) => s.setState);
  const setTimeRemaining = useQuizStore((s) => s.setTimeRemaining);
  const setQuestions = useQuizStore((s) => s.setQuestions);
  const setCurrentIndex = useQuizStore((s) => s.setCurrentIndex);
  const setStartTime = useQuizStore((s) => s.setStartTime);
  const setQuestionStartTime = useQuizStore((s) => s.setQuestionStartTime);
  const setTimePerQuestion = useQuizStore((s) => s.setTimePerQuestion);
  const setPerQuestionSeconds = useQuizStore((s) => s.setPerQuestionSeconds);
  const addAnswer = useQuizStore((s) => s.addAnswer);
  const setMarksData = useQuizStore((s) => s.setMarksData);
  const reset = useQuizStore((s) => s.reset);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const perQuestionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasSubmittedRef = useRef(false);
  const responsesRef = useRef<{ selected: string | string[] | null; category: 'I' | 'II' }[]>([]);
  const scoringProfileRef = useRef<ScoringProfile | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const examCodeRef = useRef<string | null>(null);
  const [scoringProfile, setScoringProfile] = useState<ScoringProfile | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (perQuestionTimerRef.current) {
      clearInterval(perQuestionTimerRef.current);
      perQuestionTimerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((duration: number) => {
    clearTimer();
    setTimeRemaining(duration);
    timerRef.current = setInterval(() => {
      const current = useQuizStore.getState().timeRemaining;
      if (current <= 1) {
        clearTimer();
        setTimeRemaining(0);
        setState('finished');
        return;
      }
      setTimeRemaining(current - 1);
    }, 1000);
  }, [clearTimer, setTimeRemaining, setState]);

  const startPerQuestionTimerRef = useRef<((seconds: number) => void) | null>(null);

  useEffect(() => {
    startPerQuestionTimerRef.current = (seconds: number) => {
      setTimeRemaining(seconds);
      setQuestionStartTime(Date.now());
      perQuestionTimerRef.current = setInterval(() => {
        const current = useQuizStore.getState().timeRemaining;
        if (current <= 1) {
          clearTimer();
          setTimeRemaining(0);
          const { questions, currentIndex } = useQuizStore.getState();
          if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setTimeRemaining(seconds);
            setQuestionStartTime(Date.now());
            startPerQuestionTimerRef.current?.(seconds);
          } else {
            setState('finished');
          }
          return;
        }
        setTimeRemaining(current - 1);
      }, 1000);
    };
  }, [clearTimer, setTimeRemaining, setQuestionStartTime, setCurrentIndex, setState]);

  const startQuiz = useCallback(async (quizId: string, subjectId?: string) => {
    reset();
    responsesRef.current = [];
    scoringProfileRef.current = null;
    sessionIdRef.current = null;
    hasSubmittedRef.current = false;
    setState('loading');
    try {
      const { documents: quizzes } = await databases.listDocuments(
        DB_ID,
        'quizzes',
        [Query.equal('$id', quizId), Query.limit(1)]
      );
      const quiz = quizzes[0] as Record<string, unknown> | undefined;

      examCodeRef.current = (quiz?.exam_code as string) ?? null;

      if (quiz?.scoring_profile_id) {
        const sp = { marks_correct: Number(quiz.marks_correct ?? 1), marks_wrong: Number(quiz.marks_wrong ?? -0.25) } as ScoringProfile;
        scoringProfileRef.current = sp;
        setScoringProfile(sp);
      }

      let attemptedIds: string[] = [];
      if (user) {
        try {
          const { documents: attempts } = await databases.listDocuments(DB_ID, 'attempts', [
            Query.equal('userId', user.id),
            Query.limit(5000),
          ]);
          attemptedIds = [...new Set((attempts as any[]).map((a) => a.questionId).filter(Boolean))];
        } catch {}
      }

      let rawQuestions: Record<string, unknown>[] = [];

      const { documents: quizQuestions } = await databases.listDocuments(
        DB_ID,
        'quiz_questions',
        [
          Query.equal('quiz_id', quizId),
          Query.orderAsc('order_index'),
        ]
      );

      if (quizQuestions?.length) {
        const questionIds = quizQuestions.map((qq: any) => qq.question_id).filter(Boolean);
        if (questionIds.length > 0) {
          const { documents: qs } = await databases.listDocuments(
            DB_ID,
            'questions',
            [
              Query.equal('$id', questionIds),
              Query.limit(100),
            ]
          );
          rawQuestions = qs as Record<string, unknown>[];
        }
      }

      if (!rawQuestions.length) {
        const count = (quiz?.question_count as number) || 10;
        const queries = [Query.notEqual('archived', true), Query.limit(Math.max(count * 3, 100))];
        if (quiz?.exam_code) queries.push(Query.equal('exam_code', quiz.exam_code as string));
        if (quiz?.subject_name) queries.push(Query.equal('subject_name', quiz.subject_name as string));
        const { documents: randomQ } = await databases.listDocuments(
          DB_ID,
          'questions',
          queries
        );
        if (randomQ?.length) {
          const pool = (randomQ as Record<string, unknown>[]).filter((rq) => !attemptedIds.includes(rq.$id as string));
          const source = pool.length >= count ? pool : (randomQ as Record<string, unknown>[]);
          const shuffled = [...source].sort(() => Math.random() - 0.5);
          rawQuestions = shuffled.slice(0, count) as Record<string, unknown>[];
        }
      }

      if (!rawQuestions.length) {
        setState('idle');
        return;
      }

      const questions: QuestionWithStatus[] = rawQuestions.map((q) => {
        const correctAnswers = (q.correctAnswers as string[]) ?? [String(q.correct)];
        const category = (q.category as 'I' | 'II') ?? 'I';
        return {
          id: String(q.$id ?? q.id),
          question: String(q.questionText ?? q.question ?? ''),
          options: [
            { label: 'A', text: String(q.option_a ?? '') },
            { label: 'B', text: String(q.option_b ?? '') },
            { label: 'C', text: String(q.option_c ?? '') },
            { label: 'D', text: String(q.option_d ?? '') },
          ],
          correctAnswers,
          category,
          explanation: String(q.explanation ?? ''),
          difficulty: String(q.difficulty ?? '') as 'easy' | 'medium' | 'hard',
          topic: String(q.topic ?? ''),
          subject: String(q.subject_name ?? ''),
        };
      });

      const totalDuration = (quiz?.duration_seconds as number) || 600;
      const perQuestionSeconds = quiz?.per_question_seconds as number | null;
      const timePerQ = perQuestionSeconds ?? Math.max(15, Math.floor(totalDuration / questions.length));

      setQuestions(questions);
      setTimePerQuestion(timePerQ);
      setPerQuestionSeconds(perQuestionSeconds);
      setStartTime(Date.now());
      setQuestionStartTime(Date.now());
      setState('active');

      if (user) {
        const maxScore = scoringProfileRef.current
          ? questions.length * Number(scoringProfileRef.current.marks_correct)
          : questions.length;
        try {
          const session = await databases.createDocument(
            DB_ID,
            'quiz_sessions',
            ID.unique(),
            {
              userId: user.id,
              quizId,
              startedAt: new Date().toISOString(),
              totalQuestions: questions.length,
              maxScore: maxScore,
              status: 'active',
            }
          );
          if (session) {
            sessionIdRef.current = session.$id;
            setSessionId(session.$id);
          }
        } catch {}
      }

      if (perQuestionSeconds) {
        startPerQuestionTimerRef.current?.(perQuestionSeconds);
      } else {
        startTimer(totalDuration);
      }
    } catch (err) {
      console.error('Failed to start quiz:', err);
      setState('idle');
    }
  }, [reset, setState, setQuestions, setTimePerQuestion, setPerQuestionSeconds, setStartTime, setQuestionStartTime, user, startTimer]);

  const submitAnswer = useCallback(async (selected: string | string[] | null) => {
    if (hasSubmittedRef.current) return;
    const { questions, currentIndex, questionStartTime } = useQuizStore.getState();
    const q = questions[currentIndex];
    if (!q || q.answered) return;

    hasSubmittedRef.current = true;
    const timeMs = Date.now() - (questionStartTime || useQuizStore.getState().startTime);

    let isCorrect = false;
    let marksAwarded: number | undefined;
    if (q.category === 'I') {
      isCorrect = selected === q.correctAnswers[0];
      if (scoringProfileRef.current) {
        marksAwarded = calculateScoring(isCorrect, scoringProfileRef.current);
      } else {
        marksAwarded = isCorrect ? 1.0 : -0.25;
      }
    } else if (q.category === 'II') {
      const selArr = selected as string[] | null;
      if (!selArr || selArr.length === 0) {
        isCorrect = false;
        marksAwarded = 0;
      } else {
        const hasWrong = selArr.some(s => !q.correctAnswers.includes(s));
        if (hasWrong) {
          isCorrect = false;
          marksAwarded = -0.25;
        } else {
          const partialRatio = selArr.length / q.correctAnswers.length;
          marksAwarded = 2 * partialRatio;
          isCorrect = partialRatio > 0;
        }
      }
    }

    addAnswer(q.id, { selected, isCorrect, timeMs });
    responsesRef.current.push({ selected, category: q.category });

    const updated = [...useQuizStore.getState().questions];
    const safeSelected = selected ?? undefined;
    updated[currentIndex] = { ...updated[currentIndex], answered: true, selected: safeSelected, isCorrect };
    setQuestions(updated);

    if (user) {
      try {

        await databases.createDocument(
          DB_ID,
          'attempts',
          ID.unique(),
          {
            userId: user.id,
            questionId: q.id,
            subject_name: q.subject ?? '',
            selectedOption: Array.isArray(selected) ? selected.join(',') : selected,
            isCorrect,
            timeTakenMs: timeMs,
          }
        );

        if (sessionIdRef.current) {
          await databases.createDocument(
            DB_ID,
            'session_answers',
            ID.unique(),
            {
              sessionId: sessionIdRef.current,
              userId: user.id,
              questionId: q.id,
              orderIndex: currentIndex,
              selectedOption: Array.isArray(selected) ? selected.join(',') : selected,
              isCorrect,
              marksAwarded,
              timeTakenMs: timeMs,
              answeredAt: new Date().toISOString(),
            }
          );
        }

        try {
          const questionDoc = await databases.getDocument(DB_ID, 'questions', q.id);
          if ((questionDoc as any).explanation) {
            const questionsWithExplanation = [...useQuizStore.getState().questions];
            questionsWithExplanation[currentIndex] = {
              ...questionsWithExplanation[currentIndex],
              explanation: (questionDoc as any).explanation,
            };
            setQuestions(questionsWithExplanation);
          }
        } catch {}
      } catch {}
    }

    hasSubmittedRef.current = false;
  }, [user, addAnswer, setQuestions]);

  const nextQuestion = useCallback(() => {
    const { questions, currentIndex, perQuestionSeconds } = useQuizStore.getState();
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setQuestionStartTime(Date.now());
      hasSubmittedRef.current = false;

      if (perQuestionSeconds) {
        startPerQuestionTimerRef.current?.(perQuestionSeconds);
      }
    } else {
      const { questions: qs, answers } = useQuizStore.getState();
      const catQ = qs.map(q => ({ category: q.category, correctAnswers: q.correctAnswers }));
      const respItems = qs.map(q => {
        const a = answers[q.id];
        return { selected: a?.selected ?? null, category: q.category };
      });
      const marksData = calculateMarksV2(respItems, catQ);
      setMarksData(marksData);

      if (sessionIdRef.current) {
        const { marksEarned, correct, wrong } = marksData;
        databases.updateDocument(DB_ID, 'quiz_sessions', sessionIdRef.current, {
          submittedAt: new Date().toISOString(),
          status: 'submitted',
          score: marksEarned,
          correctCount: correct,
          wrongCount: wrong,
          attemptedCount: correct + wrong,
        }).then(() => {}, () => {});
      }

      setState('finished');

      if (user && examCodeRef.current) {
        databases.getDocument(DB_ID, 'profiles', user.id).then((profile) => {
          if (profile) {
            const p = profile as Record<string, unknown>;
            const newTotalMarksEarned = (p.totalMarksEarned as number ?? 0) + marksData.marksEarned;
            const newTotalAttempted = (p.totalQuestionsAttempted as number ?? 0) + marksData.totalMarks;
            const newCorrect = (p.totalCorrect as number ?? 0) + marksData.correct;
            const newWrong = (p.totalWrong as number ?? 0) + marksData.wrong;
            const newSkipped = (p.totalSkipped as number ?? 0) + marksData.skipped;

            databases.updateDocument(DB_ID, 'profiles', user.id, {
              totalMarksEarned: newTotalMarksEarned,
              totalQuestionsAttempted: newTotalAttempted,
              totalCorrect: newCorrect,
              totalWrong: newWrong,
              totalSkipped: newSkipped,
            }).then(() => {
              upsertLeaderboardEntries(
                user.id,
                examCodeRef.current!,
                user.displayName || '',
                user.photoURL ?? null,
                marksData.marksEarned,
                marksData.correct,
                marksData.wrong,
                newTotalMarksEarned,
                newCorrect,
                newWrong,
              );
              checkAndUpdateStreak(user.id);
            }, () => {});
          }
        }, () => {});
      }
    }
  }, [setCurrentIndex, setQuestionStartTime, setMarksData, setState, user]);

  const finishQuiz = useCallback(async () => {
    clearTimer();
    const { questions, answers } = useQuizStore.getState();
    const catQ = questions.map(q => ({ category: q.category, correctAnswers: q.correctAnswers }));
    const respItems = questions.map(q => {
      const a = answers[q.id];
      return { selected: a?.selected ?? null, category: q.category };
    });
    const marksData = calculateMarksV2(respItems, catQ);
    setMarksData(marksData);

    if (sessionIdRef.current) {
      await databases.updateDocument(DB_ID, 'quiz_sessions', sessionIdRef.current, {
        submittedAt: new Date().toISOString(),
        status: 'submitted',
        score: marksData.marksEarned,
        correctCount: marksData.correct,
        wrongCount: marksData.wrong,
        attemptedCount: marksData.correct + marksData.wrong,
      });
    }

    setState('finished');

    if (user) {
      try {
        const { marksEarned, totalMarks } = useQuizStore.getState();
        const profile = await databases.getDocument(DB_ID, 'profiles', user.id) as unknown as {
          totalMarksEarned: number;
          totalQuestionsAttempted: number;
          totalCorrect: number;
          totalWrong: number;
          totalSkipped: number;
        };
        if (profile) {
          const newTotalMarksEarned = (profile.totalMarksEarned ?? 0) + marksEarned;
          const newTotalAttempted = (profile.totalQuestionsAttempted ?? 0) + totalMarks;
          const newCorrect = (profile.totalCorrect ?? 0) + marksData.correct;
          const newWrong = (profile.totalWrong ?? 0) + marksData.wrong;
          const newSkipped = (profile.totalSkipped ?? 0) + marksData.skipped;

          await databases.updateDocument(DB_ID, 'profiles', user.id, {
            totalMarksEarned: newTotalMarksEarned,
            totalQuestionsAttempted: newTotalAttempted,
            totalCorrect: newCorrect,
            totalWrong: newWrong,
            totalSkipped: newSkipped,
          });

          if (examCodeRef.current) {
            await upsertLeaderboardEntries(
              user.id,
              examCodeRef.current,
              user.displayName || '',
              user.photoURL ?? null,
              marksData.marksEarned,
              marksData.correct,
              marksData.wrong,
              newTotalMarksEarned,
              newCorrect,
              newWrong,
            );
          }
          checkAndUpdateStreak(user.id);
        }
      } catch {}
    }
  }, [clearTimer, user, setMarksData, setState]);

  useEffect(() => {
    return () => {
      clearTimer();
      hasSubmittedRef.current = false;
    };
  }, [clearTimer]);

  // Read reactive state values individually so the hook re-renders only when they change
  const state = useQuizStore((s) => s.state);
  const questions = useQuizStore((s) => s.questions);
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const timeRemaining = useQuizStore((s) => s.timeRemaining);
  const timePerQuestion = useQuizStore((s) => s.timePerQuestion);
  const answers = useQuizStore((s) => s.answers);
  const startTime = useQuizStore((s) => s.startTime);
  const perQuestionSeconds = useQuizStore((s) => s.perQuestionSeconds);
  const marksEarned = useQuizStore((s) => s.marksEarned);
  const totalMarks = useQuizStore((s) => s.totalMarks);
  const storeCorrect = useQuizStore((s) => s.correct);
  const storeWrong = useQuizStore((s) => s.wrong);
  const storeSkipped = useQuizStore((s) => s.skipped);
  const storeNegativePenalty = useQuizStore((s) => s.negativePenalty);

  return {
    state,
    questions,
    currentIndex,
    timeRemaining,
    timePerQuestion,
    answers,
    startTime,
    perQuestionSeconds,
    marksEarned,
    totalMarks,
    correct: storeCorrect,
    wrong: storeWrong,
    skipped: storeSkipped,
    negativePenalty: storeNegativePenalty,
    startQuiz,
    startTimer,
    submitAnswer,
    nextQuestion,
    finishQuiz,
    scoringProfile,
    sessionId,
    currentQuestion: questions[currentIndex],
  };
}
