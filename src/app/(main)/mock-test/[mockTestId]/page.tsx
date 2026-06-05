'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { databases } from '@/lib/appwrite/client';
import { Query, ID } from 'appwrite';
import { useAuthStore } from '@/store/authStore';
import { updateStats } from '@/services/updateStats';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Clock, ChevronLeft, ChevronRight, Send, CheckCircle2, Flag,
} from 'lucide-react';
import type { MockTestQuestion } from '@/types/quiz';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

interface AnswerState {
  selected: string;
  isCorrect: boolean;
  timeMs: number;
}

export default function MockTestTakingPage() {
  const params = useParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [phase, setPhase] = useState<'loading' | 'active' | 'submitting' | 'finished'>('loading');
  const [questions, setQuestions] = useState<MockTestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [examCode, setExamCode] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const startTimeRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const mockTestId = params.mockTestId as string;
  const q = questions[currentIndex];
  const answered = q ? answers[q.$id ?? q.id ?? ''] : undefined;
  const answeredCount = Object.keys(answers).length;
  const correctCount = Object.values(answers).filter((a) => a.isCorrect).length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mt = await databases.getDocument(DB_ID, 'mock_tests', mockTestId);
        if (cancelled) return;
        const mtData = mt as Record<string, unknown>;
        const exam = mtData.exam_code as string;
        setExamCode(exam);
        const dur = (mtData.duration_seconds as number) || 5400;

        const { documents: qs } = await databases.listDocuments(DB_ID, 'mock_test_questions', [
          Query.equal('mock_test_id', mockTestId),
          Query.orderAsc('order_index'),
          Query.limit(100),
        ]);
        if (cancelled) return;
        const typed = qs as unknown as MockTestQuestion[];
        setQuestions(typed);
        setTimeRemaining(dur);
        startTimeRef.current = Date.now();

        if (user) {
          try {
            const session = await databases.createDocument(DB_ID, 'quiz_sessions', ID.unique(), {
              quizId: mockTestId,
              userId: user.id,
              startedAt: new Date().toISOString(),
              totalQuestions: typed.length,
              maxScore: typed.length,
              status: 'active',
            });
            setSessionId(session.$id);
          } catch {}
        }

        setPhase('active');
      } catch {
        setPhase('loading');
      }
    })();
    return () => { cancelled = true; };
  }, [mockTestId, user]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    if (phase !== 'active') return;
    timerRef.current = setInterval(() => {
      setTimeRemaining((t) => {
        if (t <= 1) { clearTimer(); return 0; }
        return t - 1;
      });
    }, 1000);
    return clearTimer;
  }, [phase, clearTimer]);

  const submitRef = useRef(() => {});
  const phaseRef = useRef(phase);
  const answersRef = useRef(answers);
  const questionsRef = useRef(questions);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  useEffect(() => {
    submitRef.current = () => {
    const p = phaseRef.current;
    if (p !== 'active') return;
    setPhase('submitting');
    clearTimer();

    const currentAnswers = answersRef.current;
    const currentQuestions = questionsRef.current;
    const total = currentQuestions.length;
    const correct = Object.values(currentAnswers).filter((a) => a.isCorrect).length;
    const wrong = Object.values(currentAnswers).filter((a) => !a.isCorrect).length;
    const skipped = total - correct - wrong;
    const score = Math.round((correct * 1 + wrong * -0.25) * 100) / 100;
    const sid = sessionIdRef.current;

    if (sid && user) {
      (async () => {
        try {
          await databases.updateDocument(DB_ID, 'quiz_sessions', sid, {
            submittedAt: new Date().toISOString(),
            status: 'submitted',
            score,
            correctCount: correct,
            wrongCount: wrong,
            attemptedCount: correct + wrong,
          });

          for (const qu of currentQuestions) {
            const qId = qu.$id ?? qu.id ?? '';
            const ans = currentAnswers[qId];
            await databases.createDocument(DB_ID, 'session_answers', ID.unique(), {
              sessionId: sid,
              userId: user.id,
              questionId: qId,
              orderIndex: qu.order_index,
              selectedOption: ans?.selected ?? null,
              isCorrect: ans?.isCorrect ?? false,
              marksAwarded: ans?.isCorrect ? 1 : 0,
              timeTakenMs: ans?.timeMs ?? 0,
              answeredAt: new Date().toISOString(),
            });
          }
        } catch {}
        if (user && examCode) {
          updateStats(user.id, user.displayName ?? '', user.photoURL ?? '', examCode, score, total, correct, wrong, skipped);
        }
        setPhase('finished');
        const p = new URLSearchParams({
          sessionId: sid ?? '',
          score: String(score),
          total: String(total),
          correct: String(correct),
          wrong: String(wrong),
          skipped: String(skipped),
          examCode,
        });
        router.push(`/mock-test/result?${p.toString()}`);
      })();
    } else {
      if (user && examCode) {
        updateStats(user.id, user.displayName ?? '', user.photoURL ?? '', examCode, score, total, correct, wrong, skipped);
      }
      setPhase('finished');
      const p = new URLSearchParams({
        sessionId: '',
        score: String(score),
        total: String(total),
        correct: String(correct),
        wrong: String(wrong),
        skipped: String(skipped),
        examCode,
      });
      router.push(`/mock-test/result?${p.toString()}`);
    }
  };
  }, [user, examCode, router]);

  useEffect(() => {
    if (timeRemaining <= 0 && phase === 'active') {
      submitRef.current();
    }
  }, [timeRemaining, phase]);

  const handleAnswer = useCallback((option: string) => {
    if (!q || answered) return;
    const isCorrect = option.toUpperCase() === (q.correct ?? '').toUpperCase();
    setAnswers((prev) => ({ ...prev, [q.$id ?? q.id ?? '']: { selected: option, isCorrect, timeMs: Date.now() - startTimeRef.current } }));
  }, [q, answered]);

  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  const isLowTime = timeRemaining <= 300;

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-ink-muted italic">Loading mock test...</p>
        </div>
      </div>
    );
  }

  if (phase === 'submitting') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-ink-muted italic">Submitting your answers...</p>
        </div>
      </div>
    );
  }

  if (!q) return null;

  const allAnswered = questions.every((qu) => answers[qu.$id ?? qu.id ?? '']);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto">
      <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm pb-4 pt-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Clock size={18} className={isLowTime ? 'text-danger' : 'text-primary'} />
            <span className={`font-bold tabular-nums text-lg ${isLowTime ? 'text-danger animate-pulse' : 'text-ink'}`}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-ink-muted">
            <span>Q {currentIndex + 1} of {questions.length}</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 size={14} className="text-success" /> {correctCount}
            </span>
            <span className="flex items-center gap-1">
              <Flag size={14} /> {answeredCount}
            </span>
          </div>
        </div>
        <div className="w-full bg-surface2 rounded-full h-2">
          <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
            {currentIndex + 1}
          </span>
        </div>

        <p className="text-xl font-semibold text-ink leading-relaxed">{q.question}</p>

        <div className="space-y-3">
          {[
            { label: 'A', text: q.option_a },
            { label: 'B', text: q.option_b },
            { label: 'C', text: q.option_c },
            { label: 'D', text: q.option_d },
          ].map((opt) => {
            const isSelected = answered?.selected === opt.label;
            return (
              <button
                key={opt.label}
                onClick={() => handleAnswer(opt.label)}
                disabled={!!answered}
                className={`w-full text-left p-4 rounded-xl border-2 flex items-center gap-4 transition-all
                  ${isSelected ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:border-primary/50'}
                  ${answered ? 'cursor-default' : 'cursor-pointer'}
                `}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
                  ${isSelected ? 'bg-primary text-white' : 'bg-surface2 text-ink-muted'}
                `}>
                  {opt.label}
                </span>
                <span className="text-sm text-ink">{opt.text}</span>
              </button>
            );
          })}
        </div>

        {answered && q.explanation && (
          <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
            <p className="text-sm text-ink-muted leading-relaxed">{q.explanation}</p>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between mt-4">
        <Button
          variant="ghost"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft size={18} /> Previous
        </Button>

        <div className="flex items-center gap-2">
          {currentIndex > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setCurrentIndex(0)}>
              1
            </Button>
          )}
          <span className="text-xs text-ink-muted">{currentIndex + 1}/{questions.length}</span>
          {currentIndex < questions.length - 1 && (
            <Button variant="ghost" size="sm" onClick={() => setCurrentIndex(questions.length - 1)}>
              {questions.length}
            </Button>
          )}
        </div>

        {currentIndex < questions.length - 1 ? (
          <Button onClick={() => setCurrentIndex((i) => i + 1)}>
            Next <ChevronRight size={18} />
          </Button>
        ) : (
          <Button onClick={() => submitRef.current()} variant={allAnswered ? 'primary' : 'secondary'}>
            <Send size={18} /> {allAnswered ? 'Submit All' : `Submit (${questions.length - answeredCount} unanswered)`}
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
        {questions.map((qu, i) => {
          const ans = answers[qu.$id ?? qu.id ?? ''];
          let bg = 'bg-surface2';
          if (ans?.isCorrect) bg = 'bg-success';
          else if (ans && !ans.isCorrect) bg = 'bg-danger';
          else if (i === currentIndex) bg = 'bg-primary';
          return (
            <button
              key={qu.$id ?? qu.id}
              onClick={() => setCurrentIndex(i)}
              className={`w-7 h-7 rounded text-[10px] font-bold text-white ${bg} ${i === currentIndex ? 'ring-2 ring-primary ring-offset-2 ring-offset-canvas' : ''}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
