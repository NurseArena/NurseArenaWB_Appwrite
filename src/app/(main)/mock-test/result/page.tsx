'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { databases } from '@/lib/appwrite/client';
import { Query } from 'appwrite';
import {
  Home, RotateCcw, Trophy, CheckCircle2, XCircle, MinusCircle, ChevronDown, ChevronUp, Lightbulb,
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

  const searchScore = parseInt(searchParams.get('score') ?? '');
  const searchTotal = parseInt(searchParams.get('total') ?? '');
  const searchCorrect = parseInt(searchParams.get('correct') ?? '');
  const searchWrong = parseInt(searchParams.get('wrong') ?? '');
  const searchSkipped = parseInt(searchParams.get('skipped') ?? '');
  const sessionId = searchParams.get('sessionId') ?? '';

  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong' | 'skipped'>('all');
  const [computedScore, setComputedScore] = useState(searchScore);
  const [computedTotal, setComputedTotal] = useState(searchTotal);
  const [computedCorrect, setComputedCorrect] = useState(searchCorrect);
  const [computedWrong, setComputedWrong] = useState(searchWrong);
  const [computedSkipped, setComputedSkipped] = useState(searchSkipped);

  const score = isNaN(computedScore) ? 0 : computedScore;
  const total = isNaN(computedTotal) ? 0 : computedTotal;
  const correct = isNaN(computedCorrect) ? 0 : computedCorrect;
  const wrong = isNaN(computedWrong) ? 0 : computedWrong;
  const skipped = isNaN(computedSkipped) ? 0 : computedSkipped;

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const paramsResolvedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!sessionId) {
          setQuestions([]);
          return;
        }

        if (!paramsResolvedRef.current && isNaN(computedTotal)) {
          try {
            const sessionDoc = await databases.getDocument(DB_ID, 'quiz_sessions', sessionId) as Record<string, unknown>;
            if (!cancelled && sessionDoc) {
              paramsResolvedRef.current = true;
              setComputedScore(Number(sessionDoc.score) ?? 0);
              setComputedTotal(Number(sessionDoc.maxScore) ?? 0);
              setComputedCorrect(Number(sessionDoc.correctCount) ?? 0);
              setComputedWrong(Number(sessionDoc.wrongCount) ?? 0);
              setComputedSkipped((Number(sessionDoc.totalQuestions) ?? 0) - (Number(sessionDoc.correctCount) ?? 0) - (Number(sessionDoc.wrongCount) ?? 0));
            }
          } catch {}
        }

        const { documents: answers } = await databases.listDocuments(DB_ID, 'session_answers', [
          Query.equal('sessionId', sessionId),
          Query.orderAsc('orderIndex'),
        ]);
        if (cancelled) return;

        const questionIds = [...new Set(answers.map((a: any) => a.questionId))];
        const { documents: rawQuestions } = await databases.listDocuments(DB_ID, 'mock_test_questions', [
          Query.equal('$id', questionIds),
          Query.orderAsc('order_index'),
        ]);

        if (cancelled) return;
        const qMap = new Map((rawQuestions as any[]).map((q) => [q.$id, q]));

        const review: ReviewQuestion[] = (answers as any[]).map((a) => {
          const qData = qMap.get(a.questionId) as any;
          const isCorrect = a.isCorrect;
          return {
            id: a.questionId,
            index: a.orderIndex,
            question: qData?.question ?? '',
            options: [
              { label: 'A', text: qData?.option_a ?? '' },
              { label: 'B', text: qData?.option_b ?? '' },
              { label: 'C', text: qData?.option_c ?? '' },
              { label: 'D', text: qData?.option_d ?? '' },
            ],
            correct: qData?.correct ?? '',
            explanation: qData?.explanation ?? '',
            selected: a.selectedOption,
            isCorrect,
            answered: !!a.selectedOption,
          };
        });

        review.sort((a, b) => a.index - b.index);
        setQuestions(review);
      } catch {
        setQuestions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const filtered = questions.filter((q) => {
    if (filter === 'correct') return q.isCorrect;
    if (filter === 'wrong') return q.answered && !q.isCorrect;
    if (filter === 'skipped') return !q.answered;
    return true;
  });

  const isPerfect = percentage >= 100;
  const isGood = percentage >= 70;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="text-center pt-6">
        <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center ${isPerfect ? 'bg-success/10 text-success' : isGood ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}`}>
          <Trophy size={48} />
        </div>
        <h1 className="text-3xl font-bold text-ink">
          {isPerfect ? 'Perfect Score!' : isGood ? 'Great Job!' : 'Keep Practicing!'}
        </h1>
        <p className="text-ink-muted mt-1">{score} / {total} marks</p>
      </div>

      <Card className="p-6">
        <div className="text-center mb-4">
          <p className="text-5xl font-bold text-ink">{percentage}%</p>
          <p className="text-sm text-ink-muted mt-1">Scoring: +1 correct / −0.25 wrong</p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1">
              <CheckCircle2 size={18} className="text-success" />
              <span className="text-2xl font-bold text-success">{correct}</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Correct</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1">
              <XCircle size={18} className="text-danger" />
              <span className="text-2xl font-bold text-danger">{wrong}</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Wrong</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1">
              <MinusCircle size={18} className="text-ink-muted" />
              <span className="text-2xl font-bold text-ink-muted">{skipped}</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Skipped</p>
          </div>
        </div>
        <div className="mt-3 text-center text-xs text-ink-muted">
          Score = {correct}×1 + {wrong}×(−0.25) = <span className="font-bold text-ink">{score}</span>
        </div>
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
          <Home size={18} /> Dashboard
        </Button>
        <Button className="flex-1" onClick={() => router.push('/mock-test')}>
          <RotateCcw size={18} /> More Mock Tests
        </Button>
      </div>
    </motion.div>
  );
}

export default function MockTestResultPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto pt-10 text-center text-ink-muted">Loading result...</div>}>
      <ResultContent />
    </Suspense>
  );
}
