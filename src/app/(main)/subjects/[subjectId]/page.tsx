'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'next/navigation';
import { useExam } from '@/hooks/useExam';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Play, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { databases } from '@/lib/appwrite/client';
import { Query } from 'appwrite';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export default function SubjectDetailPage() {
  const params = useParams();
  const { subjects, examName, activeExam } = useExam();
  const subject = subjects.find((s) => s.name === params.subjectId);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { documents: subjectsDocs } = await databases.listDocuments(DB_ID, 'subjects', [
          Query.equal('name', subject?.name ?? ''),
          Query.equal('exam_code', activeExam),
          Query.limit(1),
        ]);
        if (cancelled || !subjectsDocs.length) { setLoading(false); return; }
        const subjectId = subjectsDocs[0].$id;
        const { documents: topicDocs } = await databases.listDocuments(DB_ID, 'topics', [
          Query.equal('subject_id', subjectId),
          Query.orderAsc('name'),
          Query.limit(100),
        ]);
        if (!cancelled) setTopics((topicDocs as any[]).map((t) => t.name as string).filter(Boolean));
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [subject?.name, activeExam]);

  if (!subject) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-muted italic">Subject not found</p>
        <Link href="/subjects" className="text-primary font-bold mt-4 inline-block">
          Back to subjects
        </Link>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Link
        href="/subjects"
        className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors"
      >
        <ArrowLeft size={18} />
        Back to subjects
      </Link>

      <div className="flex items-center gap-4">
        <span className="text-5xl">{subject.icon}</span>
        <div>
          <h1 className="text-3xl font-bold text-ink">{subject.name}</h1>
          <p className="text-sm text-ink-muted">{examName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-2xl font-bold text-ink">{subject.totalQ}</p>
          <p className="text-xs text-ink-muted">Questions in exam</p>
        </Card>
        <Card className="p-5">
          <p className="text-2xl font-bold text-primary">{subject.marks}</p>
          <p className="text-xs text-ink-muted">Marks</p>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-ink">Practice Options</h2>

        <Link href={`/quiz/practice?subject=${subject.name}`}>
          <Button className="w-full" size="lg">
            <Play size={18} />
            Practice All Topics ({subject.name})
          </Button>
        </Link>

        {loading ? (
          <div className="text-center py-4">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : topics.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-ink-muted uppercase tracking-widest">Topics</h3>
            {topics.map((topic) => (
              <Link key={topic} href={`/quiz/practice?subject=${subject.name}&topic=${encodeURIComponent(topic)}`}>
                <Card className="p-4 hover:border-primary/30 transition-all cursor-pointer flex items-center gap-3">
                  <BookOpen size={18} className="text-ink-muted shrink-0" />
                  <span className="text-sm font-medium text-ink">{topic}</span>
                  <Play size={14} className="ml-auto text-ink-muted shrink-0" />
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted italic text-center py-2">No topics defined yet</p>
        )}
      </div>
    </motion.div>
  );
}
