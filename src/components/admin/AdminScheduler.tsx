'use client';
import { useState, useEffect } from 'react';
import { databases } from '@/lib/appwrite/client';
import { Query, ID } from 'appwrite';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, AlertTriangle, X } from 'lucide-react';
import type { MockTestEvent, LiveQuizEvent } from '@/types/user';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export function AdminScheduler() {
  const [examCode, setExamCode] = useState('JENPAS-UG');
  const [mockTests, setMockTests] = useState<(MockTestEvent & { exams?: { name: string; code: string } })[]>([]);
  const [liveQuizzes, setLiveQuizzes] = useState<(LiveQuizEvent & { exams?: { name: string; code: string } })[]>([]);
  const [showMockForm, setShowMockForm] = useState(false);
  const [showLiveForm, setShowLiveForm] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [mockDate, setMockDate] = useState('');
  const [mockTime, setMockTime] = useState('');
  const [mockDuration, setMockDuration] = useState('120');
  const [mockMaxParticipants, setMockMaxParticipants] = useState('100');

  const [liveDate, setLiveDate] = useState('');
  const [liveTimezone, setLiveTimezone] = useState('Asia/Kolkata');
  const [liveDuration, setLiveDuration] = useState('30');

  useEffect(() => {
    (async () => {
      const { documents: mtDocs } = await databases.listDocuments(
        DB_ID,
        'mock_test_events',
        [Query.orderAsc('scheduled_at'), Query.limit(100)]
      );
      setMockTests(mtDocs as unknown as (MockTestEvent & { exams?: { name: string; code: string } })[]);

      const { documents: lqDocs } = await databases.listDocuments(
        DB_ID,
        'live_quiz_events',
        [Query.orderAsc('starts_at'), Query.limit(100)]
      );
      setLiveQuizzes(lqDocs as unknown as (LiveQuizEvent & { exams?: { name: string; code: string } })[]);
    })();
  }, [refreshKey]);

  const getWeekNumber = (date: Date) => {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - startOfYear.getTime();
    return Math.ceil((diff / 86400000 + startOfYear.getDay() + 1) / 7);
  };

  const handleScheduleMock = async () => {
    setWarning(null);
    const scheduledAt = new Date(`${mockDate}T${mockTime}:00`).toISOString();
    const weekNumber = getWeekNumber(new Date(scheduledAt));
    const year = new Date(scheduledAt).getFullYear();

    const { documents: existing } = await databases.listDocuments(
      DB_ID,
      'mock_test_events',
      [
        Query.equal('exam_code', examCode),
        Query.equal('week_number', weekNumber),
        Query.equal('year', year),
        Query.limit(10),
      ]
    );

    if (existing.length >= 2) {
      setWarning('Only 2 mock tests per week per exam allowed.');
      return;
    }

    const { documents: liveEvents } = await databases.listDocuments(
      DB_ID,
      'live_quiz_events',
      [
        Query.equal('exam_code', examCode),
        Query.equal('status', 'scheduled'),
        Query.limit(10),
      ]
    );

    const hasConflict = liveEvents.some((ev: any) => {
      const liveStart = new Date(ev.starts_at).getTime();
      const mockStart = new Date(scheduledAt).getTime();
      return Math.abs(liveStart - mockStart) < 30 * 60000;
    });

    if (hasConflict) {
      setWarning('Warning: This mock test is within 30 minutes of a scheduled live quiz.');
    }

    await databases.createDocument(DB_ID, 'mock_test_events', ID.unique(), {
      exam_code: examCode,
      scheduled_at: scheduledAt,
      duration_min: parseInt(mockDuration),
      max_participants: parseInt(mockMaxParticipants),
      week_number: weekNumber,
      year: year,
    });

    setShowMockForm(false);
    setRefreshKey(k => k + 1);
  };

  const handleScheduleLive = async () => {
    const startsAt = new Date(`${liveDate}T21:00:00`).toISOString();

    await databases.createDocument(DB_ID, 'live_quiz_events', ID.unique(), {
      exam_code: examCode,
      starts_at: startsAt,
      timezone: liveTimezone,
      duration_min: parseInt(liveDuration),
      status: 'scheduled',
    });

    setShowLiveForm(false);
    setRefreshKey(k => k + 1);
  };

  const handleCancelLiveQuiz = async (id: string) => {
    await databases.updateDocument(DB_ID, 'live_quiz_events', id, { status: 'cancelled' });
    setRefreshKey(k => k + 1);
  };

  const handleDeleteMockTest = async (id: string) => {
    await databases.deleteDocument(DB_ID, 'mock_test_events', id);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink">Schedule Events</h2>
          <p className="text-sm text-ink-muted">Manage mock tests and live quiz slots</p>
        </div>
        <div className="flex gap-2">
          <Select value={examCode} onChange={(e) => setExamCode(e.target.value)} className="w-40">
            <option value="JENPAS-UG">JENPAS-UG</option>
            <option value="JENPAS-PG">JENPAS-PG</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-ink">Mock Tests</h3>
            <Button size="sm" onClick={() => setShowMockForm(true)}>+ Schedule</Button>
          </div>
          {showMockForm && (
            <div className="space-y-3 p-4 bg-surface2 rounded-xl">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input type="date" value={mockDate} onChange={(e) => setMockDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Time</Label>
                  <Input type="time" value={mockTime} onChange={(e) => setMockTime(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Duration (min)</Label>
                  <Input type="number" value={mockDuration} onChange={(e) => setMockDuration(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Max Participants</Label>
                  <Input type="number" value={mockMaxParticipants} onChange={(e) => setMockMaxParticipants(e.target.value)} />
                </div>
              </div>
              {warning && (
                <div className="flex items-center gap-2 text-xs text-warning">
                  <AlertTriangle size={14} />
                  {warning}
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleScheduleMock}>Create</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowMockForm(false)}>Cancel</Button>
              </div>
            </div>
          )}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {mockTests.filter(m => (m as any).exam_code === examCode).map((mt) => (
              <div key={(mt as any).$id} className="flex items-center justify-between p-3 bg-surface2 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-ink">
                    <CalendarDays size={14} className="inline mr-1" />
                    {new Date((mt as any).scheduled_at).toLocaleDateString()} {new Date((mt as any).scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-ink-muted">{(mt as any).duration_min} min · {(mt as any).max_participants ?? '∞'} slots</p>
                </div>
                <button onClick={() => handleDeleteMockTest((mt as any).$id)} className="text-ink-muted hover:text-danger">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-ink">Live Quizzes (9 PM)</h3>
            <Button size="sm" onClick={() => setShowLiveForm(true)}>+ Schedule</Button>
          </div>
          {showLiveForm && (
            <div className="space-y-3 p-4 bg-surface2 rounded-xl">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={liveDate} onChange={(e) => setLiveDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Timezone</Label>
                  <Select value={liveTimezone} onChange={(e) => setLiveTimezone(e.target.value)}>
                    <option value="Asia/Kolkata">Asia/Kolkata</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Duration (min) ≤60</Label>
                  <Input type="number" max={60} value={liveDuration} onChange={(e) => setLiveDuration(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleScheduleLive}>Create</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowLiveForm(false)}>Cancel</Button>
              </div>
            </div>
          )}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {liveQuizzes.filter(l => (l as any).exam_code === examCode).map((lq) => (
              <div key={(lq as any).$id} className="flex items-center justify-between p-3 bg-surface2 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-ink">
                    <Clock size={14} className="inline mr-1" />
                    {new Date((lq as any).starts_at).toLocaleDateString()} 9:00 PM
                  </p>
                  <p className="text-xs text-ink-muted">{(lq as any).duration_min} min · {(lq as any).timezone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={(lq as any).status === 'live' ? 'danger' : (lq as any).status === 'scheduled' ? 'warning' : 'default'}>{(lq as any).status}</Badge>
                  {(lq as any).status !== 'cancelled' && (
                    <button onClick={() => handleCancelLiveQuiz((lq as any).$id)} className="text-ink-muted hover:text-danger">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
