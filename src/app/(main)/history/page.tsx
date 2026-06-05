'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { databases } from '@/lib/appwrite/client';
import { Query } from 'appwrite';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Clock, BookOpen, Zap, Swords, ScrollText, Eye, CheckCircle2, XCircle, MinusCircle,
} from 'lucide-react';
import type { QuizSessionRecord } from '@/types/quiz';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  mock_test: { icon: Swords, label: 'Mock Test', color: 'text-accent' },
  quiz: { icon: BookOpen, label: 'Quiz', color: 'text-primary' },
  topicwise: { icon: ScrollText, label: 'Topicwise', color: 'text-primary' },
  rapid_fire: { icon: Zap, label: 'Rapid Fire', color: 'text-warning' },
  pyq: { icon: Clock, label: 'PYQ', color: 'text-ink' },
};

export default function HistoryPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [sessions, setSessions] = useState<QuizSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const queries: any[] = [
          Query.equal('userId', user.id),
          Query.equal('status', 'submitted'),
          Query.orderDesc('submittedAt'),
          Query.limit(200),
        ];
        const { documents } = await databases.listDocuments(DB_ID, 'quiz_sessions', queries);
        if (!cancelled) setSessions(documents as unknown as QuizSessionRecord[]);
      } catch { if (!cancelled) setSessions([]); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const types = [...new Set(sessions.map((s) => s.type ?? 'quiz'))];
  const filtered = filter ? sessions.filter((s) => (s.type ?? 'quiz') === filter) : sessions;

  const getResultUrl = (s: QuizSessionRecord) => {
    if (s.type === 'mock_test') {
      return `/mock-test/result?sessionId=${s.id}&score=${s.score}&total=${s.maxScore}&correct=${s.correctCount}&wrong=${s.wrongCount}&skipped=${s.maxScore - s.correctCount - s.wrongCount}`;
    }
    return `/quiz/result?marksEarned=${s.score}&totalMarks=${s.maxScore}&correct=${s.correctCount}&wrong=${s.wrongCount}&skipped=${s.maxScore - s.correctCount - s.wrongCount}&sessionId=${s.id}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">Activity History</h1>
        <p className="text-sm text-ink-muted mt-1">Review all your completed tests and quizzes</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${!filter ? 'bg-primary text-white' : 'bg-surface2 text-ink-muted'}`}
        >
          All ({sessions.length})
        </button>
        {types.map((t) => {
          const cfg = TYPE_CONFIG[t] ?? { icon: BookOpen, label: t, color: 'text-primary' };
          const count = sessions.filter((s) => (s.type ?? 'quiz') === t).length;
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${filter === t ? 'bg-primary text-white' : 'bg-surface2 text-ink-muted'}`}
            >
              <cfg.icon size={12} /> {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-ink-muted italic">No completed activities yet.</p>
          <Button variant="ghost" className="mt-4" onClick={() => router.push('/dashboard')}>
            Go to Dashboard
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const cfg = TYPE_CONFIG[s.type ?? 'quiz'] ?? { icon: BookOpen, label: 'Quiz', color: 'text-primary' };
            const Icon = cfg.icon;
            const pct = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0;
            return (
              <Card key={s.id} className="p-4 hover:border-primary/30 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.color} bg-current/10`}>
                      <Icon size={20} className={cfg.color} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="font-bold text-ink text-sm truncate">
                        {s.title ?? `${cfg.label} Session`}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-ink-muted mt-0.5">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-success" /> {s.correctCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <XCircle size={12} className="text-danger" /> {s.wrongCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <MinusCircle size={12} className="text-ink-muted" /> {s.maxScore - s.correctCount - s.wrongCount}
                        </span>
                        <span className="font-bold text-ink">{pct}%</span>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => router.push(getResultUrl(s))}>
                    <Eye size={14} /> Review
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
