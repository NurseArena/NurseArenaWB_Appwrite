'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuizStore } from '@/store/quizStore';
import { useAuthStore } from '@/store/authStore';
import { databases } from '@/lib/appwrite/client';
import { Query, ID } from 'appwrite';
import { calculateMarks as calculateMarksV2 } from '@/lib/xp';
import { calculateMarks as calculateScoring, calculateSessionScore } from '@/lib/scoring';
import type { QuestionWithStatus, ScoringProfile } from '@/types/quiz';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export function useQuiz() {
  const store = useQuizStore();
  const user = useAuthStore((s) => s.user);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const perQuestionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasSubmittedRef = useRef(false);
  const responsesRef = useRef<{ selected: string | string[] | null; category: 'I' | 'II' }[]>([]);
  const scoringProfileRef = useRef<ScoringProfile | null>(null);
  const sessionIdRef = useRef<string | null>(null);
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
    store.setTimeRemaining(duration);
    timerRef.current = setInterval(() => {
      const current = useQuizStore.getState().timeRemaining;
      if (current <= 1) {
        clearTimer();
        store.setTimeRemaining(0);
        store.setState('finished');
        return;
      }
      store.setTimeRemaining(current - 1);
    }, 1000);
  }, [clearTimer, store]);

  const startPerQuestionTimerRef = useRef<((seconds: number) => void) | null>(null);

  useEffect(() => {
    startPerQuestionTimerRef.current = (seconds: number) => {
      store.setTimeRemaining(seconds);
      store.setQuestionStartTime(Date.now());
      perQuestionTimerRef.current = setInterval(() => {
        const current = useQuizStore.getState().timeRemaining;
        if (current <= 1) {
          clearTimer();
          store.setTimeRemaining(0);
          const { questions, currentIndex } = useQuizStore.getState();
          if (currentIndex < questions.length - 1) {
            store.setCurrentIndex(currentIndex + 1);
            store.setTimeRemaining(seconds);
            store.setQuestionStartTime(Date.now());
            startPerQuestionTimerRef.current?.(seconds);
          } else {
            store.setState('finished');
          }
          return;
        }
        store.setTimeRemaining(current - 1);
      }, 1000);
    };
  }, [clearTimer, store]);

  const startQuiz = useCallback(async (quizId: string, subjectId?: string) => {
    store.reset();
    responsesRef.current = [];
    scoringProfileRef.current = null;
    sessionIdRef.current = null;
    hasSubmittedRef.current = false;
    store.setState('loading');
    try {
      const { documents: quizzes } = await databases.listDocuments(
        DB_ID,
        'quizzes',
        [Query.equal('$id', quizId), Query.limit(1)]
      );
      const quiz = quizzes[0] as Record<string, unknown> | undefined;

      if (quiz?.scoring_profile_id) {
        const sp = { marks_correct: Number(quiz.marks_correct ?? 1), marks_wrong: Number(quiz.marks_wrong ?? -0.25) } as ScoringProfile;
        scoringProfileRef.current = sp;
        setScoringProfile(sp);
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
        const queries = [Query.equal('archived', [false, null] as any), Query.limit(count)];
        if (quiz?.exam_code) queries.push(Query.equal('exam_code', quiz.exam_code as string));
        if (quiz?.subject_name) queries.push(Query.equal('subject_name', quiz.subject_name as string));
        const { documents: randomQ } = await databases.listDocuments(
          DB_ID,
          'questions',
          queries
        );
        if (randomQ?.length) {
          const shuffled = [...randomQ].sort(() => Math.random() - 0.5);
          rawQuestions = shuffled.slice(0, count) as Record<string, unknown>[];
        }
      }

      if (!rawQuestions.length) {
        store.setState('idle');
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
        };
      });

      const totalDuration = (quiz?.duration_seconds as number) || 600;
      const perQuestionSeconds = quiz?.per_question_seconds as number | null;
      const timePerQ = perQuestionSeconds ?? Math.max(15, Math.floor(totalDuration / questions.length));

      store.setQuestions(questions);
      store.setTimePerQuestion(timePerQ);
      store.setPerQuestionSeconds(perQuestionSeconds);
      store.setStartTime(Date.now());
      store.setQuestionStartTime(Date.now());
      store.setState('active');

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
      store.setState('idle');
    }
  }, [store, startTimer]);

  const submitAnswer = useCallback(async (selected: string | string[] | null) => {
    if (hasSubmittedRef.current) return;
    const { questions, currentIndex, questionStartTime } = useQuizStore.getState();
    const q = questions[currentIndex];
    if (!q || q.answered) return;

    hasSubmittedRef.current = true;
    const timeMs = Date.now() - (questionStartTime || useQuizStore.getState().startTime);

    let isCorrect = false;
    if (q.category === 'I') {
      isCorrect = selected === q.correctAnswers[0];
    } else if (q.category === 'II') {
      const selArr = selected as string[];
      isCorrect = selArr?.length > 0 && !selArr.some(s => !q.correctAnswers.includes(s));
    }

    store.addAnswer(q.id, { selected, isCorrect, timeMs });
    responsesRef.current.push({ selected, category: q.category });

    const updated = [...useQuizStore.getState().questions];
    const safeSelected = selected ?? undefined;
    updated[currentIndex] = { ...updated[currentIndex], answered: true, selected: safeSelected, isCorrect };
    store.setQuestions(updated);

    if (user) {
      try {
        let marksAwarded: number | undefined;
        if (scoringProfileRef.current) {
          marksAwarded = calculateScoring(isCorrect, scoringProfileRef.current);
        } else {
          marksAwarded = isCorrect ? 1.0 : -0.25;
        }

        await databases.createDocument(
          DB_ID,
          'attempts',
          ID.unique(),
          {
            userId: user.id,
            questionId: q.id,
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
            store.setQuestions(questionsWithExplanation);
          }
        } catch {}
      } catch {}
    }

    hasSubmittedRef.current = false;
  }, [store, user]);

  const nextQuestion = useCallback(() => {
    const { questions, currentIndex, perQuestionSeconds } = useQuizStore.getState();
    if (currentIndex < questions.length - 1) {
      store.setCurrentIndex(currentIndex + 1);
      store.setQuestionStartTime(Date.now());
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
      store.setMarksData(marksData);

      if (sessionIdRef.current) {
        const { marksEarned, correct, wrong, skipped } = marksData;
        databases.updateDocument(DB_ID, 'quiz_sessions', sessionIdRef.current, {
          submittedAt: new Date().toISOString(),
          status: 'submitted',
          score: marksEarned,
          correctCount: correct,
          wrongCount: wrong,
          attemptedCount: correct + wrong,
        }).then(() => {}, () => {});
      }

      store.setState('finished');
    }
  }, [store]);

  const finishQuiz = useCallback(async () => {
    clearTimer();
    const { questions, answers } = useQuizStore.getState();
    const catQ = questions.map(q => ({ category: q.category, correctAnswers: q.correctAnswers }));
    const respItems = questions.map(q => {
      const a = answers[q.id];
      return { selected: a?.selected ?? null, category: q.category };
    });
    const marksData = calculateMarksV2(respItems, catQ);
    store.setMarksData(marksData);

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

    store.setState('finished');

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
          await databases.updateDocument(DB_ID, 'profiles', user.id, {
            totalMarksEarned: (profile.totalMarksEarned ?? 0) + marksEarned,
            totalQuestionsAttempted: (profile.totalQuestionsAttempted ?? 0) + totalMarks,
            totalCorrect: (profile.totalCorrect ?? 0) + marksData.correct,
            totalWrong: (profile.totalWrong ?? 0) + marksData.wrong,
            totalSkipped: (profile.totalSkipped ?? 0) + marksData.skipped,
          });
        }
      } catch {}
    }
  }, [clearTimer, store, user]);

  useEffect(() => {
    return () => {
      clearTimer();
      hasSubmittedRef.current = false;
    };
  }, [clearTimer]);

  return {
    ...store,
    startQuiz,
    startTimer,
    submitAnswer,
    nextQuestion,
    finishQuiz,
    scoringProfile,
    sessionId,
    currentQuestion: store.questions[store.currentIndex],
  };
}
