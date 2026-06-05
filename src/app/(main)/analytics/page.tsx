'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { databases } from '@/lib/appwrite/client';
import { Query } from 'appwrite';
import { useExam } from '@/hooks/useExam';
import { Card } from '@/components/ui/card';
import { AccuracyChart } from '@/components/charts/AccuracyChart';
import { ActivityHeatmap } from '@/components/charts/ActivityHeatmap';
import { ExamBadge } from '@/components/exam/ExamBadge';
import { BarChart3, Brain, Target, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const FILL_COLORS = ['#6366f1', '#a855f7', '#22d3ee', '#f59e0b', '#ec4899', '#10b981', '#3b82f6', '#ef4444'];

export default function AnalyticsPage() {
  const { subjects } = useExam();
  const user = useAuthStore((s) => s.user);
  const [subjectData, setSubjectData] = useState<{ subject: string; accuracy: number; fill: string }[]>([]);

  const totalQs = user?.totalQuestionsAttempted ?? 0;
  const totalCorrect = user?.totalCorrect ?? 0;
  const totalWrong = user?.totalWrong ?? 0;
  const totalSkipped = user?.totalSkipped ?? 0;
  const accuracy = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0;
  const streakDays = user?.streakDays ?? 0;
  const totalMarks = user?.totalMarksEarned ?? 0;

  const hasData = totalQs > 0;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { documents } = await databases.listDocuments(DB_ID, 'attempts', [
          Query.equal('userId', user.id),
          Query.limit(2000),
        ]);
        if (cancelled) return;

        const subjectMap = new Map<string, { correct: number; total: number }>();
        for (const doc of documents) {
          const a = doc as Record<string, unknown>;
          const sub = (a.subject_name as string) || '';
          if (!sub) continue;
          const entry = subjectMap.get(sub) ?? { correct: 0, total: 0 };
          entry.total++;
          if (a.isCorrect) entry.correct++;
          subjectMap.set(sub, entry);
        }

        const computed = subjects
          .filter((s) => subjectMap.has(s.name))
          .map((s, i) => ({
            subject: s.name,
            accuracy: Math.round((subjectMap.get(s.name)!.correct / subjectMap.get(s.name)!.total) * 100),
            fill: FILL_COLORS[i % FILL_COLORS.length],
          }));

        for (const [sub, data] of subjectMap) {
          if (!subjects.some((s) => s.name === sub)) {
            computed.push({
              subject: sub,
              accuracy: Math.round((data.correct / data.total) * 100),
              fill: FILL_COLORS[computed.length % FILL_COLORS.length],
            });
          }
        }

        if (!cancelled) setSubjectData(computed);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [user, subjects]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">Analytics</h1>
          <p className="text-sm text-ink-muted mt-1">Track your progress</p>
        </div>
        <ExamBadge />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: BarChart3, label: 'Total Questions', value: totalQs.toLocaleString() },
          { icon: Target, label: 'Accuracy', value: accuracy > 0 ? `${accuracy}%` : '0%', color: 'text-primary' },
          { icon: TrendingUp, label: 'Streak Days', value: `${streakDays}d`, color: 'text-success' },
          { icon: Brain, label: 'Total Marks', value: totalMarks.toLocaleString(), color: 'text-accent' },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <stat.icon size={20} className={stat.color ?? 'text-ink-muted'} />
            <p className="text-2xl font-bold text-ink mt-2">{stat.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">{stat.label}</p>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-bold text-ink mb-4">Per-Subject Accuracy</h2>
        <Card className="p-5">
          {subjectData.length > 0 ? (
            <AccuracyChart data={subjectData} />
          ) : (
            <p className="text-sm text-ink-muted text-center py-4">No subject data yet. Start practicing to see your accuracy.</p>
          )}
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-bold text-ink mb-4">Activity (Last 30 Days)</h2>
        <Card className="p-5">
          <ActivityHeatmap />
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-bold text-ink mb-4">Correct vs Wrong</h2>
        <Card className="p-4">
          {hasData ? (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-ink-muted">Correct</span>
                  <span className="font-bold text-success">{totalCorrect}</span>
                </div>
                <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: `${(totalCorrect / totalQs) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-ink-muted">Wrong</span>
                  <span className="font-bold text-danger">{totalWrong}</span>
                </div>
                <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                  <div className="h-full bg-danger rounded-full" style={{ width: `${(totalWrong / totalQs) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-ink-muted">Skipped</span>
                  <span className="font-bold text-warning">{totalSkipped}</span>
                </div>
                <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                  <div className="h-full bg-warning rounded-full" style={{ width: `${(totalSkipped / totalQs) * 100}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-muted text-center py-4">No data yet. Complete your first quiz to see your breakdown.</p>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
