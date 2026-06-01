import { databases } from '@/lib/appwrite/client';
import { Query, ID } from 'appwrite';
import type { MockTestEvent } from '@/types/user';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export async function fetchUpcomingMockTests(examId?: string) {
  const queries = [
    Query.greaterThan('scheduled_at', new Date().toISOString()),
    Query.orderAsc('scheduled_at'),
  ];
  if (examId) queries.push(Query.equal('exam_code', examId));

  const { documents } = await databases.listDocuments(
    DB_ID,
    'mock_test_events',
    queries
  );
  return documents as unknown as (MockTestEvent & { exams?: { name: string; code: string } })[];
}

export async function getMockTestCountdown(eventId: string) {
  const data = await databases.getDocument(
    DB_ID,
    'mock_test_events',
    eventId
  );
  return data as unknown as MockTestEvent | null;
}

export function getTimeUntilEvent(scheduledAt: string) {
  const now = Date.now();
  const event = new Date(scheduledAt).getTime();
  const diff = event - now;
  if (diff <= 0) return { isActive: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    isActive: false,
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

export function isWithinWindow(scheduledAt: string, durationMin: number) {
  const now = Date.now();
  const start = new Date(scheduledAt).getTime();
  const end = start + durationMin * 60000;
  return now >= start && now <= end;
}

export async function startMockTest(eventId: string, _userId: string) {
  const event = await getMockTestCountdown(eventId);
  if (!event) throw new Error('Mock test not found');
  if (!isWithinWindow((event as any).scheduled_at, (event as any).duration_min)) {
    throw new Error('Mock test is not currently active');
  }
  const { documents } = await databases.listDocuments(
    DB_ID,
    'questions',
    [
      Query.equal('exam_code', (event as any).exam_code),
      Query.limit(50),
    ]
  );
  return documents;
}

const MAX_RESPONSES = 200;

export async function submitMockTestResponses(eventId: string, userId: string, responses: { question_id: string; selected_option: string; time_taken_ms: number; is_correct: boolean }[]) {
  if (responses.length > MAX_RESPONSES) {
    throw new Error(`Too many responses (max ${MAX_RESPONSES})`);
  }

  const attempts = responses.map(r => ({
    userId,
    questionId: r.question_id,
    selectedOption: r.selected_option,
    isCorrect: r.is_correct,
    timeTakenMs: r.time_taken_ms,
  }));

  const results = [];
  for (const attempt of attempts) {
    const data = await databases.createDocument(
      DB_ID,
      'attempts',
      ID.unique(),
      attempt
    );
    results.push(data);
  }
  return results;
}
