'use client';
import { useState, useEffect } from 'react';
import { databases } from '@/lib/appwrite/client';
import { Query, ID } from 'appwrite';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { CalendarPlus, RefreshCw, XCircle } from 'lucide-react';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const QUIZ_REQUIRED = 50;

export default function AdminQuizzesPage() {
  const [title, setTitle] = useState('');
  const [examCode, setExamCode] = useState('JENPAS-UG');
  const [type, setType] = useState('quiz');
  const [durationMins, setDurationMins] = useState('30');
  const [questionCount, setQuestionCount] = useState('50');
  const [perQuestionSeconds, setPerQuestionSeconds] = useState('');
  const [scoringProfileId, setScoringProfileId] = useState('');
  const [liveAtDate, setLiveAtDate] = useState('');
  const [liveAtTime, setLiveAtTime] = useState('21:00');
  const [status, setStatus] = useState('');
  const [quizzes, setQuizzes] = useState<Record<string, unknown>[]>([]);
  const [poolMap, setPoolMap] = useState<Record<string, { available: number; reserved: number; used: number; quizzes_possible: number }>>({});
  const [editFailedId, setEditFailedId] = useState<string | null>(null);
  const [newLiveAtDate, setNewLiveAtDate] = useState('');

  const fetchPool = async () => {
    const { documents } = await databases.listDocuments(
      DB_ID,
      'questions',
      [Query.limit(5000)]
    );
    const counts = new Map<string, { available: number; reserved: number; used: number }>();
    for (const q of documents as unknown as { exam_code: string; quiz_pool_status: string }[]) {
      const code = q.exam_code ?? 'UNKNOWN';
      let entry = counts.get(code);
      if (!entry) { entry = { available: 0, reserved: 0, used: 0 }; counts.set(code, entry); }
      if (q.quiz_pool_status === 'available') entry.available++;
      else if (q.quiz_pool_status === 'reserved') entry.reserved++;
      else if (q.quiz_pool_status === 'used') entry.used++;
    }
    const map: Record<string, { available: number; reserved: number; used: number; quizzes_possible: number }> = {};
    for (const [code, c] of counts) {
      map[code] = { ...c, quizzes_possible: Math.floor(c.available / QUIZ_REQUIRED) };
    }
    setPoolMap(map);
  };

  useEffect(() => {
    fetchPool();
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    const { documents } = await databases.listDocuments(
      DB_ID,
      'quizzes',
      [Query.orderDesc('$createdAt'), Query.limit(100)]
    );
    setQuizzes(documents as Record<string, unknown>[]);
  };

  const handleCreate = async () => {
    setStatus('');
    try {
      const isQuizType = type === 'quiz';
      if (isQuizType) {
        const pool = poolMap[examCode];
        if (!pool || pool.available < QUIZ_REQUIRED) {
          setStatus(`Cannot schedule: only ${pool?.available ?? 0} available questions (need ${QUIZ_REQUIRED}). Upload more questions first.`);
          return;
        }
      }

      const liveAt = isQuizType && liveAtDate
        ? new Date(`${liveAtDate}T${liveAtTime}:00+05:30`).toISOString()
        : null;

      const quiz = await databases.createDocument(
        DB_ID,
        'quizzes',
        ID.unique(),
        {
          exam_code: examCode,
          title,
          type,
          question_count: parseInt(questionCount),
          duration_seconds: parseInt(durationMins) * 60,
          per_question_seconds: perQuestionSeconds ? parseInt(perQuestionSeconds) : null,
          scoring_profile_id: scoringProfileId || null,
          is_active: true,
          live_at: liveAt,
          live_status: liveAt ? 'scheduled' : null,
        }
      );

      if (isQuizType && quiz) {
        await reservePoolQuestions(quiz.$id, examCode);
        fetchPool();
      }

      setStatus(isQuizType ? `Quiz "${title}" scheduled with ${QUIZ_REQUIRED} questions reserved!` : `Quiz "${title}" created!`);
      setTitle('');
      fetchQuizzes();
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const reservePoolQuestions = async (quizId: string, code: string) => {
    const { documents: picked } = await databases.listDocuments(
      DB_ID,
      'questions',
      [
        Query.equal('exam_code', code),
        Query.equal('quiz_pool_status', 'available'),
        Query.limit(QUIZ_REQUIRED),
      ]
    );
    if (picked && picked.length >= QUIZ_REQUIRED) {
      const ids = picked.map((r: any) => r.$id);
      for (const id of ids) {
        await databases.updateDocument(DB_ID, 'questions', id, { quiz_pool_status: 'reserved' });
        await databases.createDocument(DB_ID, 'quiz_questions', ID.unique(), {
          quiz_id: quizId,
          question_id: id,
          order_index: ids.indexOf(id),
        });
      }
    }
  };

  const releasePoolQuestions = async (quizId: string) => {
    const { documents: qq } = await databases.listDocuments(
      DB_ID,
      'quiz_questions',
      [Query.equal('quiz_id', quizId)]
    );
    if (qq?.length) {
      for (const r of qq as any[]) {
        await databases.updateDocument(DB_ID, 'questions', r.question_id, { quiz_pool_status: 'available' });
        await databases.deleteDocument(DB_ID, 'quiz_questions', r.$id);
      }
    }
  };

  const handleCancel = async (q: Record<string, unknown>) => {
    if (q.type === 'quiz') {
      await releasePoolQuestions(q.$id as string);
    }
    await databases.updateDocument(DB_ID, 'quizzes', q.$id as string, { live_status: 'closed', is_active: false });
    fetchQuizzes();
    fetchPool();
  };

  const handleMarkUsed = async (q: Record<string, unknown>) => {
    if (q.type === 'quiz') {
      const { documents: qq } = await databases.listDocuments(
        DB_ID,
        'quiz_questions',
        [Query.equal('quiz_id', q.$id as string)]
      );
      if (qq?.length) {
        for (const r of qq as any[]) {
          await databases.updateDocument(DB_ID, 'questions', r.question_id, { quiz_pool_status: 'used' });
        }
      }
      fetchPool();
    }
  };

  const isScheduled = type === 'quiz';
  const pool = poolMap[examCode];
  const canSchedule = !isScheduled || (pool?.available ?? 0) >= QUIZ_REQUIRED;

  const statusBadge = (s: string) => {
    const variants: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'accent'> = {
      scheduled: 'warning',
      live: 'success',
      closed: 'default',
      failed: 'danger',
    };
    return <Badge variant={variants[s] ?? 'default'}>{s}</Badge>;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold text-ink">Quiz Management</h1>

      <Card className={`p-6 space-y-4`}>
        <h2 className="font-semibold text-lg">Create New Quiz</h2>

        {isScheduled && pool && (
          <div className={`p-3 rounded-xl text-sm ${pool.available >= QUIZ_REQUIRED ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
            {pool.available >= QUIZ_REQUIRED
              ? `${examCode} — Available pool: ${pool.available} questions.`
              : `Cannot schedule quiz for ${examCode} — only ${pool.available} questions available (need ${QUIZ_REQUIRED}). Upload more questions first.`}
          </div>
        )}

        <div className="space-y-2">
          <Label>Quiz Title</Label>
          <Input placeholder="e.g. Weekly Quiz 5" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Exam</Label>
            <Select value={examCode} onChange={(e) => setExamCode(e.target.value)}>
              <option value="JENPAS-UG">JENPAS-UG</option>
              <option value="JENPAS-PG">JENPAS-PG</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="quiz">Daily Quiz (50 Qs)</option>
              <option value="topicwise">Topic-wise</option>
              <option value="mock">Mock Test</option>
              <option value="rapid_fire">Rapid Fire</option>
              <option value="live">Live Quiz</option>
              <option value="pyq">PYQ</option>
              <option value="daily">Daily Challenge</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input type="number" value={durationMins} onChange={(e) => setDurationMins(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Question Count</Label>
            <Input type="number" value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Per-Question Timer (seconds, optional)</Label>
          <Input type="number" placeholder="e.g. 15" value={perQuestionSeconds} onChange={(e) => setPerQuestionSeconds(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Scoring Profile ID (optional)</Label>
          <Input value={scoringProfileId} onChange={(e) => setScoringProfileId(e.target.value)} placeholder="e.g. default" />
        </div>

        {isScheduled && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Live Date</Label>
                <Input type="date" value={liveAtDate} onChange={(e) => setLiveAtDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Live Time (IST)</Label>
                <Input type="time" value={liveAtTime} onChange={(e) => setLiveAtTime(e.target.value)} />
              </div>
            </div>
          </>
        )}

        {status && (
          <p className={`text-sm ${status.startsWith('Error') || status.startsWith('Cannot') ? 'text-danger' : 'text-success'}`}>{status}</p>
        )}

        <Button onClick={handleCreate} className="w-full" disabled={!canSchedule && isScheduled}>
          <CalendarPlus size={18} />
          {isScheduled ? 'Schedule Quiz' : 'Create Quiz'}
        </Button>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold text-lg">All Quizzes</h2>
        {quizzes.length === 0 ? (
          <p className="text-sm text-ink-muted italic">No quizzes created yet.</p>
        ) : (
          quizzes.map((q) => (
            <Card key={q.$id as string} className="p-4 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-ink">{q.title as string}</p>
                  {statusBadge((q.live_status as string) ?? (q.is_active ? 'scheduled' : 'closed'))}
                </div>
                <p className="text-xs text-ink-muted mt-1">
                  {q.exam_code as string ?? ''} &middot; {q.type as string}
                  &middot; {q.question_count as string} Qs &middot; {Math.round(Number(q.duration_seconds) / 60)} min
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                {(q.live_status === 'scheduled' || q.live_status === 'failed') && q.type === 'quiz' && (
                  <Button size="sm" variant="ghost" onClick={() => handleCancel(q)}><XCircle size={14} /> Cancel</Button>
                )}
                {q.live_status === 'closed' && q.type === 'quiz' && (
                  <Button size="sm" variant="ghost" onClick={() => handleMarkUsed(q)}>Mark Used</Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </motion.div>
  );
}
