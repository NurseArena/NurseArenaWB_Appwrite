'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { databases } from '@/lib/appwrite/client';
import { Query, ID } from 'appwrite';
import { useExam } from '@/hooks/useExam';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, CheckCircle2, XCircle, MinusCircle, Lightbulb, Trophy, Home, RotateCcw } from 'lucide-react';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const QUESTIONS_PER_BATCH = 10;

interface PQQuestion {
  id: string;
  question: string;
  options: { label: string; text: string }[];
  correct: string;
  explanation?: string;
  topic?: string;
}

interface PQAnswer {
  selected: string;
  isCorrect: boolean;
}

function PracticeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const subject = searchParams.get('subject');
  const { activeExam } = useExam();
  const user = useAuthStore((s) => s.user);

  const [phase, setPhase] = useState<'loading' | 'active' | 'result'>('loading');
  const [questions, setQuestions] = useState<PQQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, PQAnswer>>({});

  const q = questions[currentIndex];
  const answered = q ? answers[q.id] : undefined;
  const correctCount = Object.values(answers).filter((a) => a.isCorrect).length;
  const wrongCount = Object.values(answers).filter((a) => !a.isCorrect).length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let attemptedIds: string[] = [];
        if (user) {
          try {
            const { documents: attempts } = await databases.listDocuments(DB_ID, 'attempts', [
              Query.equal('userId', user.id),
              Query.limit(5000),
            ]);
            attemptedIds = (attempts as any[]).map((a) => a.questionId).filter(Boolean);
          } catch {}
        }

        const queries: any[] = [
          Query.equal('exam_code', activeExam),
          Query.equal('archived', [false, null] as any),
          Query.limit(100),
        ];
        if (subject) queries.push(Query.equal('subject_name', subject));

        const { documents: raw } = await databases.listDocuments(DB_ID, 'questions', queries);
        if (cancelled) return;

        let pool = (raw as Record<string, unknown>[]).filter((rq) => !attemptedIds.includes(rq.$id as string));
        if (pool.length < 1) pool = raw as Record<string, unknown>[];

        const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_BATCH);
        const mapped: PQQuestion[] = shuffled.map((rq) => ({
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
          topic: rq.topic as string,
        }));
        setQuestions(mapped);
        setPhase('active');
      } catch {
        setPhase('loading');
      }
    })();
    return () => { cancelled = true; };
  }, [activeExam, subject, user]);

  const handleAnswer = useCallback((selected: string) => {
    if (!q || answered) return;
    const isCorrect = selected.toUpperCase() === q.correct.toUpperCase();
    setAnswers((prev) => ({ ...prev, [q.id]: { selected, isCorrect } }));
    if (user) {
      databases.createDocument(DB_ID, 'attempts', ID.unique(), {
        userId: user.id,
        questionId: q.id,
        selectedOption: selected,
        isCorrect,
        timeTakenMs: 0,
      }).catch(() => {});
    }
  }, [q, answered, user]);

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-ink-muted italic">Loading questions...</p>
        </div>
      </div>
    );
  }

  if (phase === 'result') {
    const skipped = questions.length - correctCount - wrongCount;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto space-y-4 py-8 px-4">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <Trophy size={40} className="text-success" />
          </div>
          <h1 className="text-2xl font-bold text-ink">Practice Complete!</h1>
          <p className="text-4xl font-bold text-ink mt-2">{correctCount}/{questions.length}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <CheckCircle2 size={20} className="mx-auto text-success mb-1" />
            <p className="text-2xl font-bold text-success">{correctCount}</p>
            <p className="text-xs text-ink-muted">Correct</p>
          </Card>
          <Card className="p-4 text-center">
            <XCircle size={20} className="mx-auto text-danger mb-1" />
            <p className="text-2xl font-bold text-danger">{wrongCount}</p>
            <p className="text-xs text-ink-muted">Wrong</p>
          </Card>
          <Card className="p-4 text-center">
            <MinusCircle size={20} className="mx-auto text-ink-muted mb-1" />
            <p className="text-2xl font-bold text-ink-muted">{skipped}</p>
            <p className="text-xs text-ink-muted">Skipped</p>
          </Card>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => router.back()}>
            <RotateCcw size={18} /> Try Again
          </Button>
          <Button className="flex-1" onClick={() => router.push('/subjects')}>
            <Home size={18} /> Subjects
          </Button>
        </div>
      </motion.div>
    );
  }

  if (!q) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-muted italic">No questions found for {subject}.</p>
        <Button variant="ghost" onClick={() => router.push('/subjects')} className="mt-4">
          Back to Subjects
        </Button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span>{subject} · {currentIndex + 1}/{questions.length}</span>
        <span className="flex items-center gap-1"><CheckCircle2 size={14} className="text-success" /> {correctCount}</span>
      </div>

      <div className="w-full bg-surface2 rounded-full h-1.5">
        <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={currentIndex} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-4">
          {q.topic && <span className="text-xs font-bold uppercase tracking-widest text-primary">{q.topic}</span>}
          <p className="text-lg font-semibold text-ink">{q.question}</p>

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
                  className={`w-full text-left p-4 rounded-xl border-2 flex items-center gap-3 ${bg} transition-all disabled:cursor-not-allowed`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                    answered && isCorrectOpt ? 'bg-success text-white' : isSelected ? 'bg-primary text-white' : 'bg-surface2 text-ink-muted'
                  }`}>{opt.label}</span>
                  <span className="text-sm text-ink">{opt.text}</span>
                </button>
              );
            })}
          </div>

          {answered && q.explanation && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-2">
              <Lightbulb size={16} className="text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-ink-muted">{q.explanation}</p>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {answered && (
        <Button className="w-full" onClick={() => currentIndex < questions.length - 1 ? setCurrentIndex((i) => i + 1) : setPhase('result')}>
          {currentIndex < questions.length - 1 ? <><ArrowRight size={18} /> Next Question</> : 'See Results'}
        </Button>
      )}
    </motion.div>
  );
}

export default function PracticeQuizPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <PracticeContent />
    </Suspense>
  );
}
