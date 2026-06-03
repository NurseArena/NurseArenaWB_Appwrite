'use client';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useExam } from '@/hooks/useExam';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, ListChecks, Swords, CalendarDays, Play } from 'lucide-react';
import { EXAMS } from '@/lib/exam-config';
import { databases } from '@/lib/appwrite/client';
import { Query } from 'appwrite';
import Link from 'next/link';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
import { useState } from 'react';

export default function MockTestPage() {
  const { examName, activeExam } = useExam();
  const config = EXAMS[activeExam];
  const [mockTests, setMockTests] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { documents } = await databases.listDocuments(DB_ID, 'mock_tests', [
          Query.equal('exam_code', activeExam),
          Query.equal('status', 'published'),
          Query.orderDesc('serial_number'),
          Query.limit(50),
        ]);
        if (!cancelled && documents) setMockTests(documents as Record<string, unknown>[]);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [activeExam]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">Mock Test</h1>
        <p className="text-sm text-ink-muted mt-1">
          Full exam simulation for {examName}
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Swords size={32} className="text-accent" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">{examName} Mock</h2>
            <p className="text-sm text-ink-muted">
              {config.totalQuestions} questions · {Math.floor(config.durationSeconds / 60)} minutes
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-3 p-3 bg-surface2 rounded-xl">
            <Clock size={20} className="text-primary" />
            <div>
              <p className="text-sm font-bold text-ink">{Math.floor(config.durationSeconds / 60)} min</p>
              <p className="text-[10px] text-ink-muted">Duration</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-surface2 rounded-xl">
            <ListChecks size={20} className="text-primary" />
            <div>
              <p className="text-sm font-bold text-ink">{config.totalQuestions}</p>
              <p className="text-[10px] text-ink-muted">Questions</p>
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">Subjects</p>
          {config.subjects.map((s) => (
            <div key={s.name} className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">
                {s.icon} {s.name}
              </span>
              <span className="text-ink font-bold">{s.totalQ} Q · {s.marks} marks</span>
            </div>
          ))}
        </div>
      </Card>

      <div>
        <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
          <CalendarDays size={20} />
          Available Mock Tests
        </h2>
        {mockTests.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-ink-muted italic">No mock tests available yet for {examName}.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {mockTests.map((mt) => (
              <Card key={mt.$id as string} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-ink">{mt.title as string}</p>
                    <p className="text-xs text-ink-muted">
                      {Math.round(Number(mt.duration_seconds ?? 0) / 60)} min · 100 questions
                    </p>
                  </div>
                  <Link href={`/mock-test/${mt.$id}`}>
                    <Button size="sm">
                      <Play size={16} /> Start
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
