'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { databases } from '@/lib/appwrite/client';
import { Query } from 'appwrite';
import {
  Home, RotateCcw, Trophy, CheckCircle2,
  ChevronDown, ChevronUp, Lightbulb,
} from 'lucide-react';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

interface ReviewQuestion {
  id: string;
  index: number;
  question: string;
  options: { label: string; text: string }[];
  correct: string;
  explanation?: string;
  selected?: string;
  isCorrect?: boolean;
  answered: boolean;
}

function ResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const marksEarned = parseFloat(searchParams.get('marksEarned') ?? '0');
  const totalMarks = parseFloat(searchParams.get('totalMarks') ?? '0');
  const correct = parseInt(searchParams.get('correct') ?? '0');
  const wrong = parseInt(searchParams.get('wrong') ?? '0');
  const skipped = parseInt(searchParams.get('skipped') ?? '0');
  const negativePenalty = parseFloat(searchParams.get('negativePenalty') ?? '0');
  const sessionId = searchParams.get('sessionId') ?? '';
  const percentage = totalMarks > 0 ? Math.round((marksEarned / totalMarks) * 100) : 0;
  const isPerfect = percentage >= 100;
  const isGood = percentage >= 80;

  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong' | 'skipped'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!sessionId) { setQuestions([]); return; }
        const { documents: answers } = await databases.listDocuments(DB_ID, 'session_answers', [
          Query.equal('sessionId', sessionId),
          Query.orderAsc('orderIndex'),
        ]);
        if (cancelled) return;

        const questionIds = [...new Set(answers.map((a: any) => a.questionId))];
        let rawQuestions: any[] = [];

        try {
          const { documents: fromQuestions } = await databases.listDocuments(DB_ID, 'questions', [
            Query.equal('$id', questionIds),
            Query.limit(100),
          ]);
          rawQuestions = fromQuestions as any[];
        } catch {}

        if (!rawQuestions.length) {
          try {
            const { documents: fromPractice } = await databases.listDocuments(DB_ID, 'practice_questions', [
              Query.equal('$id', questionIds),
              Query.limit(100),
            ]);
            rawQuestions = fromPractice as any[];
          } catch {}
        }

        if (!rawQuestions.length) {
          try {
            const { documents: fromPYQ } = await databases.listDocuments(DB_ID, 'pyq_questions', [
              Query.equal('$id', questionIds),
              Query.limit(100),
            ]);
            rawQuestions = fromPYQ as any[];
          } catch {}
        }

        if (cancelled) return;
        const qMap = new Map(rawQuestions.map((q) => [q.$id, q]));

        const review: ReviewQuestion[] = (answers as any[]).map((a) => {
          const qData = qMap.get(a.questionId) as any;
          return {
            id: a.questionId,
            index: a.orderIndex,
            question: qData?.question ?? qData?.questionText ?? '',
            options: [
              { label: 'A', text: qData?.option_a ?? '' },
              { label: 'B', text: qData?.option_b ?? '' },
              { label: 'C', text: qData?.option_c ?? '' },
              { label: 'D', text: qData?.option_d ?? '' },
            ],
            correct: qData?.correct ?? (qData?.correctAnswers ? (Array.isArray(qData.correctAnswers) ? qData.correctAnswers[0] : qData.correctAnswers) : ''),
            explanation: qData?.explanation ?? '',
            selected: a.selectedOption,
            isCorrect: a.isCorrect,
            answered: !!a.selectedOption,
          };
        });

        review.sort((a, b) => a.index - b.index);
        setQuestions(review);
      } catch { setQuestions([]); }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const filtered = questions.filter((q) => {
    if (filter === 'correct') return q.isCorrect;
    if (filter === 'wrong') return q.answered && !q.isCorrect;
    if (filter === 'skipped') return !q.answered;
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto space-y-8 pt-10 pb-12"
    >
      <div className="text-center">
        <div
          className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center ${
            isPerfect || isGood
              ? 'bg-success/10 text-success'
              : 'bg-warning/10 text-warning'
          }`}
        >
          {isPerfect || isGood ? (
            <Trophy size={48} />
          ) : (
            <CheckCircle2 size={48} />
          )}
        </div>
        <h1 className="text-3xl font-bold text-ink">
          {isPerfect ? 'Perfect Score!' : isGood ? 'Great Job!' : 'Keep Practicing!'}
        </h1>
        <p className="text-ink-muted mt-2">
          {isPerfect
            ? 'You nailed every question!'
            : isGood
              ? "You're doing great!"
              : "You'll do better next time"}
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="text-center">
          <p className="text-4xl font-bold text-ink">{marksEarned.toFixed(1)} / {totalMarks}</p>
          <p className="text-lg font-bold text-primary">{percentage}%</p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-success">{correct}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Correct</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-danger">{wrong}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Wrong</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-ink-muted">{skipped}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Skipped</p>
          </div>
        </div>
        {negativePenalty > 0 && (
          <div className="text-center">
            <p className="text-sm text-danger">Negative Penalty: -{negativePenalty.toFixed(2)} marks</p>
          </div>
        )}
      </Card>

      {questions.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-ink mb-4">Review All Questions</h2>
          <div className="flex gap-2 mb-4">
            {(['all', 'correct', 'wrong', 'skipped'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === f ? 'bg-primary text-white' : 'bg-surface2 text-ink-muted'}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? questions.length : f === 'correct' ? correct : f === 'wrong' ? wrong : skipped})
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {filtered.map((q) => {
              const isExpanded = expandedId === q.id;
              return (
                <Card key={q.id} className="overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : q.id)}
                    className="w-full p-4 flex items-start justify-between text-left hover:bg-surface2 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        q.isCorrect ? 'bg-success text-white' : q.answered ? 'bg-danger text-white' : 'bg-surface2 text-ink-muted'
                      }`}>
                        {q.index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{q.question}</p>
                        <p className={`text-xs mt-0.5 ${q.isCorrect ? 'text-success' : q.answered ? 'text-danger' : 'text-ink-muted'}`}>
                          {q.isCorrect ? 'Correct' : q.answered ? `Wrong (Your answer: ${q.selected})` : 'Skipped'}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="shrink-0 text-ink-muted" /> : <ChevronDown size={16} className="shrink-0 text-ink-muted" />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                      <p className="text-sm text-ink font-medium">{q.question}</p>
                      <div className="space-y-1.5">
                        {q.options.map((opt) => {
                          const isSelected = q.selected === opt.label;
                          const isCorrectOpt = q.correct.toUpperCase() === opt.label;
                          let bg = 'bg-surface border-border';
                          if (isCorrectOpt) bg = 'bg-success/10 border-success';
                          else if (isSelected && !isCorrectOpt) bg = 'bg-danger/10 border-danger';
                          return (
                            <div key={opt.label} className={`p-2.5 rounded-lg border text-sm flex items-center gap-2 ${bg}`}>
                              <span className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs shrink-0 ${
                                isCorrectOpt ? 'bg-success text-white' : isSelected ? 'bg-danger text-white' : 'bg-surface2 text-ink-muted'
                              }`}>
                                {opt.label}
                              </span>
                              <span className="text-ink">{opt.text}</span>
                            </div>
                          );
                        })}
                      </div>
                      {q.explanation && (
                        <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 flex items-start gap-2">
                          <Lightbulb size={16} className="text-primary shrink-0 mt-0.5" />
                          <p className="text-sm text-ink-muted">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => router.push('/dashboard')}>
          <Home size={18} />
          Dashboard
        </Button>
        <Button className="flex-1" onClick={() => router.back()}>
          <RotateCcw size={18} />
          Try Again
        </Button>
      </div>
    </motion.div>
  );
}

export default function QuizResultPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto pt-10 text-center text-ink-muted">Loading result...</div>}>
      <ResultContent />
    </Suspense>
  );
}
