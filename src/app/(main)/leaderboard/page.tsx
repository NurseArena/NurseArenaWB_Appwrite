'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { databases } from '@/lib/appwrite/client';
import { Query } from 'appwrite';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
import { useAuthStore } from '@/store/authStore';
import { useExam } from '@/hooks/useExam';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { ExamToggle } from '@/components/leaderboard/ExamToggle';
import { Trophy, Medal, Award } from 'lucide-react';
import type { LeaderboardRow, PeriodType } from '@/types/leaderboard';

const periodTabs = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'All-Time', value: 'all_time' },
];

const medals = [
  { icon: Trophy, color: 'text-warning' },
  { icon: Medal, color: 'text-ink-muted' },
  { icon: Award, color: 'text-primary' },
];

function mapRow(entry: Record<string, unknown>, i: number, currentUserId?: string): LeaderboardRow {
  const uid = (entry.userId as string) ?? (entry.user_id as string) ?? '';
  return {
    rank: i + 1,
    userId: uid,
    name: (entry.displayName as string) || '',
    avatar: entry.photoURL as string | undefined,
    marksEarned: (entry.marksEarned as number) ?? 0,
    percentage: (entry.percentage as number) ?? 0,
    wrong: (entry.wrong as number) ?? 0,
    totalMarksEarned: (entry.totalMarksEarned as number) ?? (entry.marksEarned as number) ?? 0,
    isCurrentUser: uid === currentUserId,
  };
}

async function resolveMissingNames(rows: LeaderboardRow[]): Promise<LeaderboardRow[]> {
  const missing = rows.filter((r) => !r.name);
  if (missing.length === 0) return rows;

  const nameMap = new Map<string, string>();
  const batchSize = 25;
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    const ids = batch.map((r) => r.userId);
    try {
      const { documents } = await databases.listDocuments(DB_ID, 'profiles', [
        Query.equal('$id', ids),
        Query.limit(batchSize),
      ]);
      for (const doc of documents) {
        const profile = doc as Record<string, unknown>;
        nameMap.set(
          profile.$id as string,
          (profile.displayName as string) || (profile.name as string) || '',
        );
      }
    } catch {}
  }

  return rows.map((r) => ({
    ...r,
    name: r.name || nameMap.get(r.userId) || 'User',
  }));
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [period, setPeriod] = useState<PeriodType>('all_time');
  const user = useAuthStore((s) => s.user);
  const { examName, config } = useExam();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const examId = config?.code;
        const queries = [
          ...(examId ? [Query.equal('exam_id', examId)] : []),
          Query.equal('period_type', period),
          Query.orderDesc('marksEarned'),
          Query.limit(50),
        ];
        const { documents } = await databases.listDocuments(DB_ID, 'leaderboard', queries);
        if (!cancelled && documents) {
          let mapped = documents.map((entry, i) => mapRow(entry as Record<string, unknown>, i, user?.id));
          mapped = await resolveMissingNames(mapped);
          if (!cancelled) setRows(mapped);
        }
      } catch (err) {
        console.error('Leaderboard fetch failed (create composite index: exam_id ASC + period_type ASC + marksEarned DESC):', err);
        try {
          const examId = config?.code;
          const { documents } = await databases.listDocuments(DB_ID, 'leaderboard', [
            ...(examId ? [Query.equal('exam_id', examId)] : []),
            Query.equal('period_type', period),
            Query.limit(50),
          ]);
          if (!cancelled && documents) {
            const sorted = documents.sort((a, b) => (b.marksEarned as number ?? 0) - (a.marksEarned as number ?? 0));
            let mapped = sorted.map((entry, i) => mapRow(entry as Record<string, unknown>, i, user?.id));
            mapped = await resolveMissingNames(mapped);
            if (!cancelled) setRows(mapped);
          }
        } catch (fallbackErr) {
          console.error('Leaderboard fallback fetch also failed:', fallbackErr);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [period, config?.code, user?.id]);

  const topThree = rows.slice(0, 3);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">Leaderboard</h1>
        <p className="text-sm text-ink-muted mt-1">{examName} — See where you stand</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <ExamToggle tabs={periodTabs} active={period} onChange={(v) => setPeriod(v as PeriodType)} />
      </div>

      {topThree.length > 0 && (
        <div className="flex items-end justify-center gap-4 h-48">
          {[1, 0, 2].map((idx) => {
            const user = topThree[idx];
            if (!user) return null;
            const isFirst = idx === 0;
            const medal = medals[idx] ?? medals[2];

            return (
              <div
                key={user.userId}
                className={`flex flex-col items-center ${isFirst ? 'scale-110' : 'scale-90'}`}
              >
                <medal.icon size={isFirst ? 32 : 24} className={`${medal.color} mb-2`} />
                <div
                  className={`rounded-full border-2 mb-2 ${isFirst ? 'w-16 h-16 border-primary' : 'w-12 h-12 border-border'}`}
                >
                  <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {user.name[0]}
                  </div>
                </div>
                <p className="text-sm font-bold text-ink">{user.name}</p>
                <p className="text-lg font-black text-primary">{user.marksEarned.toFixed(1)}</p>
                <p className="text-[10px] text-ink-muted">Marks</p>
              </div>
            );
          })}
        </div>
      )}

      <LeaderboardTable rows={rows} />
    </motion.div>
  );
}
