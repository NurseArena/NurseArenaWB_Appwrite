'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { databases } from '@/lib/appwrite/client';
import { Query, ID } from 'appwrite';
import { useExam } from '@/hooks/useExam';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Zap, Home, Trophy, CheckCircle2, XCircle, MinusCircle, Lightbulb } from 'lucide-react';
import { useRouter } from 'next/navigation';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const TOTAL_QUESTIONS = 20;
const TOTAL_TIME_SEC = 600;

interface RFQuestion {
  id: string;
  question: string;
  options: { label: string; text: string }[];
  correct: string;
  explanation?: string;
}

interface RFAnswer {
  selected: string;
  isCorrect: boolean;
}

export default function RapidFirePage() {
  const [phase, setPhase] = useState<'start' | 'active' | 'result'>('start');
  const [questions, setQuestions] = useState<RFQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME_SEC);
  const [answers, setAnswers] = useState<Record<string, RFAnswer>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const router = useRouter();
  const { activeExam } = useExam();
  const user = useAuthStore((s) => s.user);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null);

  const q = questions[currentIndex];
  const answered = q ? answers[q.id] : undefined;
  const correctCount = Object.values(answers).filter((a) => a.isCorrect).length;
  const wrongCount = Object.values(answers).filter((a) => !a.isCorrect).length;
  const skippedCount = currentIndex - correctCount - wrongCount;

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (autoAdvanceRef.current) { clearTimeout(autoAdvanceRef.current); autoAdvanceRef.current = null; }
  }, []);

  const advanceToNext = useCallback(() => {
    setShowExplanation(false);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      clearTimers();
      setPhase('result');
    }
  }, [currentIndex, questions.length, clearTimers]);

  const handleAnswer = useCallback((selected: string) => {
    if (!q || answered) return;
    const isCorrect = selected.toUpperCase() === q.correct.toUpperCase();
    setAnswers((prev) => ({ ...prev, [q.id]: { selected, isCorrect } }));
    setShowExplanation(true);

    if (user) {
      databases.createDocument(DB_ID, 'attempts', ID.unique(), {
        userId: user.id,
        questionId: q.id,
        selectedOption: selected,
        isCorrect,
        timeTakenMs: 0,
      }).catch(() => {});
    }

    autoAdvanceRef.current = setTimeout(() => {
      advanceToNext();
    }, 3000);
  }, [q, answered, user, advanceToNext]);

  useEffect(() => {
    if (phase !== 'active') return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearTimers();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return clearTimers;
  }, [phase, clearTimers]);

  useEffect(() => {
    if (timeLeft <= 0 && phase === 'active') {
      setPhase('result');
    }
  }, [timeLeft, phase]);

  useEffect(() => {
    if (!answered && phase === 'active') {
      const perQTimer = setTimeout(() => {
        advanceToNext();
      }, 30000);
      return () => clearTimeout(perQTimer);
    }
  }, [currentIndex, answered, phase, advanceToNext]);

  const startGame = useCallback(async () => {
    setCurrentIndex(0);
    setAnswers({});
    setShowExplanation(false);
    setTimeLeft(TOTAL_TIME_SEC);
    clearTimers();

    let attemptedIds: string[] = [];
    if (user) {
      try {
        const { documents: attempts } = await databases.listDocuments(DB_ID, 'attempts', [
          Query.equal('userId', user.id),
          Query.limit(5000),
        ]);
        attemptedIds = [...new Set((attempts as any[]).map((a) => a.questionId))];
      } catch {}
    }

    const { documents: raw } = await databases.listDocuments(DB_ID, 'rapid_fire_questions', [
      Query.equal('exam_code', activeExam),
      Query.limit(200),
    ]);

    if (!raw) return;
    let pool = (raw as Record<string, unknown>[]).filter((rq) => !attemptedIds.includes(rq.$id as string));
    if (pool.length < TOTAL_QUESTIONS) pool = raw as Record<string, unknown>[];

    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, TOTAL_QUESTIONS);
    const mapped: RFQuestion[] = shuffled.map((rq) => ({
      id: rq.$id as string,
      question: rq.question as string,
      options: [
        { label: 'A', text: rq.option_a as string },
        { label: 'B', text: rq.option_b as string },
        { label: 'C', text: rq.option_c as string },
        { label: 'D', text: rq.option_d as string },
      ],
      correct: rq.correct as string,
      explanation: rq.explanation as string,
    }));
    setQuestions(mapped);
    setPhase('active');
  }, [activeExam, user, clearTimers]);

  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  if (phase === 'start') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-warning to-accent flex items-center justify-center">
          <Zap size={40} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-ink text-center">Rapid Fire</h1>
        <div className="bg-surface2 rounded-2xl p-4 w-full max-w-sm space-y-2 text-sm text-ink-muted">
          <p>{TOTAL_QUESTIONS} questions · {TOTAL_TIME_SEC / 60} minutes</p>
          <p>30 seconds per question — auto-advances if unanswered</p>
          <p>Correct answer with explanation shown immediately after selection</p>
          <p>No navigation — just select your answer</p>
        </div>
        <Button size="lg" className="w-full max-w-sm" onClick={startGame}>
          <Zap size={18} /> Start Rapid Fire
        </Button>
      </motion.div>
    );
  }

  if (phase === 'result') {
    const percentage = TOTAL_QUESTIONS > 0 ? Math.round((correctCount / TOTAL_QUESTIONS) * 100) : 0;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto space-y-6 px-4 py-8">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-success to-primary flex items-center justify-center mx-auto mb-4">
            <Trophy size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-ink">Rapid Fire Complete!</h1>
        </div>

        <Card className="p-6 space-y-4">
          <div className="text-center">
            <p className="text-4xl font-bold text-ink">{correctCount} / {TOTAL_QUESTIONS}</p>
            <p className="text-lg font-bold text-primary">{percentage}%</p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <CheckCircle2 size={20} className="mx-auto text-success mb-1" />
              <p className="text-2xl font-bold text-success">{correctCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Correct</p>
            </div>
            <div>
              <XCircle size={20} className="mx-auto text-danger mb-1" />
              <p className="text-2xl font-bold text-danger">{wrongCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Wrong</p>
            </div>
            <div>
              <MinusCircle size={20} className="mx-auto text-ink-muted mb-1" />
              <p className="text-2xl font-bold text-ink-muted">{skippedCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Skipped</p>
            </div>
          </div>
        </Card>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {questions.map((q, i) => {
            const a = answers[q.id];
            return (
              <div key={q.id} className={`p-3 rounded-xl border text-sm ${a?.isCorrect ? 'border-success/30 bg-success/5' : a ? 'border-danger/30 bg-danger/5' : 'border-border bg-surface'}`}>
                <div className="flex items-start gap-2">
                  <span className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${a?.isCorrect ? 'bg-success text-white' : a ? 'bg-danger text-white' : 'bg-surface2 text-ink-muted'}`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-ink font-medium truncate">{q.question}</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Correct: <span className="font-bold text-success">{q.correct}</span>
                      {a && !a.isCorrect && <> · Your: <span className="font-bold text-danger">{a.selected}</span></>}
                    </p>
                    {q.explanation && <p className="text-xs text-ink-muted mt-1">{q.explanation}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={startGame}>
            <Zap size={18} /> Play Again
          </Button>
          <Button variant="ghost" className="flex-1" onClick={() => router.push('/dashboard')}>
            <Home size={18} /> Dashboard
          </Button>
        </div>
      </motion.div>
    );
  }

  if (!q) return null;

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const progress = ((currentIndex + 1) / TOTAL_QUESTIONS) * 100;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-warning" />
          <span className="text-lg font-bold text-ink">{correctCount}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-ink-muted">{currentIndex + 1}/{TOTAL_QUESTIONS}</span>
          <span className={`font-mono font-bold ${timeLeft <= 60 ? 'text-danger animate-pulse' : 'text-ink'}`}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="w-full bg-surface2 rounded-full h-2">
        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          className="space-y-4"
        >
          <p className="text-lg font-bold text-ink">{q.question}</p>

          <div className="space-y-2">
            {q.options.map((opt) => {
              const isSelected = answered?.selected === opt.label;
              const isCorrectOpt = answered && q.correct.toUpperCase() === opt.label;
              let bg = 'bg-surface border-border';
              if (answered && isCorrectOpt) bg = 'bg-success/20 border-success';
              else if (isSelected && !answered?.isCorrect) bg = 'bg-danger/20 border-danger';

              return (
                <button
                  key={opt.label}
                  onClick={() => handleAnswer(opt.label)}
                  disabled={!!answered}
                  className={`w-full text-left p-4 rounded-xl border-2 ${bg} transition-all disabled:cursor-not-allowed flex items-center gap-3`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                    answered && isCorrectOpt ? 'bg-success text-white' : isSelected ? 'bg-primary text-white' : 'bg-surface2 text-ink-muted'
                  }`}>
                    {opt.label}
                  </span>
                  <span className="text-ink text-sm">{opt.text}</span>
                </button>
              );
            })}
          </div>

          {answered && showExplanation && q.explanation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-2"
            >
              <Lightbulb size={16} className="text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-ink-muted">{q.explanation}</p>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {currentIndex < TOTAL_QUESTIONS - 1 && (
        <p className="text-center text-xs text-ink-muted">
          {answered ? 'Auto-advancing in a moment...' : 'Auto-advances in 30 seconds'}
        </p>
      )}
    </motion.div>
  );
}
