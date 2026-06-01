'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { databases } from '@/lib/appwrite/client';
import { Query } from 'appwrite';
import { useExam } from '@/hooks/useExam';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Zap, SkipForward, Home, Lock, Trophy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getRapidFireTier, RAPID_FIRE_TIERS } from '@/lib/xp';
import type { QuestionWithStatus } from '@/types/quiz';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export default function RapidFirePage() {
  const [phase, setPhase] = useState<'start' | 'active' | 'result'>('start');
  const [questions, setQuestions] = useState<QuestionWithStatus[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [answers, setAnswers] = useState<Record<string, { selected: string; isCorrect: boolean }>>({});
  const router = useRouter();
  const { activeExam } = useExam();
  const user = useAuthStore((s) => s.user);
  const handleNextRef = useRef<() => void>(() => {});

  const totalMarks = user?.totalMarksEarned ?? 0;
  const currentTier = getRapidFireTier(totalMarks);
  const currentTimer = currentTier.timerSeconds;

  const q = questions[currentIndex];
  const answered = answers[q?.id];

  const startGame = useCallback(async () => {
    const { documents: raw } = await databases.listDocuments(
      DB_ID,
      'questions',
      [
        Query.equal('exam_code', activeExam),
        Query.equal('archived', [false, null] as any),
        Query.limit(50),
      ]
    );

    if (!raw) return;

    const shuffled = [...raw].sort(() => Math.random() - 0.5).slice(0, 10);
    const mapped: QuestionWithStatus[] = (shuffled as Record<string, unknown>[]).map((rq) => ({
      id: rq.$id as string,
      question: rq.question as string,
      options: [
        { label: 'A', text: rq.option_a as string },
        { label: 'B', text: rq.option_b as string },
        { label: 'C', text: rq.option_c as string },
        { label: 'D', text: rq.option_d as string },
      ],
      correctAnswers: [rq.correct as string],
      category: 'I' as const,
      explanation: rq.explanation as string,
      difficulty: (rq.difficulty as 'easy' | 'medium' | 'hard') ?? 'easy',
      topic: rq.topic as string,
    }));
    setQuestions(mapped);
    setPhase('active');
  }, [activeExam]);

  const handleAnswer = (selected: string) => {
    if (answered || !q) return;
    const isCorrect = selected === q.correctAnswers[0];
    setAnswers((prev) => ({ ...prev, [q.id]: { selected, isCorrect } }));
  };

  const currentScore = Object.values(answers).filter((a) => a.isCorrect).length;
  const totalAttempted = Object.keys(answers).length;
  const accuracy = totalAttempted > 0 ? Math.round((currentScore / totalAttempted) * 100) : 0;

  handleNextRef.current = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setPhase('result');
    }
  }, [currentIndex, questions.length]);

  useEffect(() => {
    if (phase !== 'active' || answered) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0) {
          clearInterval(timer);
          handleNextRef.current();
          return currentTimer;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, answered, currentTimer]);

  useEffect(() => {
    setTimeLeft(currentTimer);
  }, [phase, currentIndex, currentTimer]);

  if (phase === 'start') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-warning to-accent flex items-center justify-center">
          <Zap size={40} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-ink text-center">Rapid Fire</h1>
        <p className="text-ink-muted text-center max-w-sm">
          Answer as many questions as you can. Each correct answer earns you 1 mark.
          Wrong answers = −0.25 marks. No penalty for skipping.
        </p>

        <div className="bg-surface2 rounded-2xl p-4 w-full max-w-sm space-y-3">
          {RAPID_FIRE_TIERS.map((t) => (
            <div key={t.tier} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {t.tier <= currentTier.tier ? <Zap size={14} className="text-warning" /> : <Lock size={14} className="text-ink-muted" />}
                <span className={t.tier <= currentTier.tier ? 'text-ink font-medium' : 'text-ink-muted'}>
                  Tier {t.tier}: {t.name}
                </span>
              </div>
              <span className="text-ink-muted text-xs">{t.timerSeconds}s / q</span>
            </div>
          ))}
        </div>

        <Button size="lg" className="w-full max-w-sm" onClick={startGame}>
          <Zap size={18} /> Start
        </Button>
      </motion.div>
    );
  }

  if (phase === 'result') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-success to-primary flex items-center justify-center">
          <Trophy size={40} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-ink">Session Complete!</h1>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-3xl font-bold text-success">{currentScore}</p>
            <p className="text-xs text-ink-muted">Correct</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-danger">{totalAttempted - currentScore}</p>
            <p className="text-xs text-ink-muted">Wrong</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-ink">{accuracy}%</p>
            <p className="text-xs text-ink-muted">Accuracy</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={startGame}>
            <Zap size={18} /> Play Again
          </Button>
          <Button variant="ghost" onClick={() => router.push('/dashboard')}>
            <Home size={18} /> Dashboard
          </Button>
        </div>
      </motion.div>
    );
  }

  if (!q) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-warning" />
          <span className="text-lg font-bold text-ink">{currentScore}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-ink-muted">
          <span>{currentIndex + 1} / {questions.length}</span>
          <span className={`font-mono font-bold ${timeLeft <= 5 ? 'text-danger' : 'text-ink'}`}>{timeLeft}s</span>
        </div>
      </div>

      <div className="w-full bg-surface2 rounded-full h-2">
        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={currentIndex} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="space-y-4">
          <h2 className="text-lg font-bold text-ink">{q.question}</h2>
          <div className="space-y-2">
            {q.options.map((opt) => {
              const isSelected = answered?.selected === opt.label;
              const isCorrectOption = answered && q.correctAnswers.includes(opt.label);
              let bg = 'bg-surface';
              if (answered && isCorrectOption) bg = 'bg-success/20 border-success';
              else if (isSelected && !answered?.isCorrect) bg = 'bg-danger/20 border-danger';
              else if (isSelected) bg = 'bg-primary/20 border-primary';
              return (
                <button
                  key={opt.label}
                  onClick={() => handleAnswer(opt.label)}
                  disabled={!!answered}
                  className={`w-full text-left px-4 py-3 rounded-xl border border-border ${bg} transition-all disabled:cursor-not-allowed`}
                >
                  <span className="font-bold text-ink-muted mr-2">{opt.label}.</span>
                  <span className="text-ink">{opt.text}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {answered && (
        <div className="space-y-3">
          {q.explanation && (
            <p className="text-sm text-ink-muted bg-surface2 p-3 rounded-xl">{q.explanation}</p>
          )}
          <Button className="w-full" onClick={handleNextRef.current}>
            {currentIndex < questions.length - 1 ? (
              <><SkipForward size={18} /> Next</>
            ) : (
              'See Results'
            )}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
