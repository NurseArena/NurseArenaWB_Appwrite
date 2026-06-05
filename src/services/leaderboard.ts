import { databases } from '@/lib/appwrite/client';
import { Query } from 'appwrite';
import type { PeriodType } from '@/types/leaderboard';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export async function fetchLeaderboard(examId: string, period: PeriodType = 'all_time') {
  const { documents } = await databases.listDocuments(
    DB_ID,
    'leaderboard',
    [
      Query.equal('period_type', period),
      Query.equal('exam_id', examId),
      Query.orderAsc('rank'),
      Query.limit(50),
    ]
  );
  return documents;
}

export async function getUserRank(userId: string, examId: string, period: PeriodType = 'all_time') {
  try {
    const data = await databases.getDocument(
      DB_ID,
      'leaderboard',
      `${userId}_${examId}_${period}`
    );
    return data;
  } catch {
    return null;
  }
}

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function getWeekKey(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  return monday.toISOString().split('T')[0];
}

export async function upsertLeaderboardEntries(
  userId: string,
  examCode: string,
  displayName: string,
  photoURL: string | null,
  sessionMarksEarned: number,
  sessionCorrect: number,
  sessionWrong: number,
  cumulativeMarksEarned: number,
  cumulativeCorrect: number,
  cumulativeWrong: number,
): Promise<void> {
  const periods: { type: PeriodType; marks: number; correct: number; wrong: number; key: string | null }[] = [
    { type: 'all_time', marks: cumulativeMarksEarned, correct: cumulativeCorrect, wrong: cumulativeWrong, key: null },
    { type: 'daily', marks: sessionMarksEarned, correct: sessionCorrect, wrong: sessionWrong, key: getTodayKey() },
    { type: 'weekly', marks: sessionMarksEarned, correct: sessionCorrect, wrong: sessionWrong, key: getWeekKey() },
  ];

  for (const period of periods) {
    const docId = `${userId}_${examCode}_${period.type}`;

    let existing: Record<string, unknown> | null = null;
    try {
      existing = await databases.getDocument(DB_ID, 'leaderboard', docId) as Record<string, unknown>;
    } catch {}
    const samePeriod = period.type === 'all_time' || existing?.period_start === period.key;

    let newMarks: number;
    let newCorrect: number;
    let newWrong: number;

    if (period.type === 'all_time') {
      newMarks = period.marks;
      newCorrect = period.correct;
      newWrong = period.wrong;
    } else if (existing && samePeriod) {
      newMarks = ((existing.marksEarned as number) ?? 0) + period.marks;
      newCorrect = ((existing.correct as number) ?? 0) + period.correct;
      newWrong = ((existing.wrong as number) ?? 0) + period.wrong;
    } else {
      newMarks = period.marks;
      newCorrect = period.correct;
      newWrong = period.wrong;
    }

    const attempted = newCorrect + newWrong;
    const pct = attempted > 0 ? Math.round((newCorrect / attempted) * 10000) / 100 : 0;

    try {
      await databases.updateDocument(DB_ID, 'leaderboard', docId, {
        marksEarned: newMarks,
        correct: newCorrect,
        wrong: newWrong,
        percentage: pct,
        displayName,
        photoURL,
        ...(period.key ? { period_start: period.key } : {}),
      });
    } catch {
      const attempted = period.correct + period.wrong;
      const pct = attempted > 0 ? Math.round((period.correct / attempted) * 10000) / 100 : 0;

      const createData: Record<string, unknown> = {
        userId,
        exam_id: examCode,
        period_type: period.type,
        displayName,
        photoURL,
        marksEarned: period.marks,
        correct: period.correct,
        wrong: period.wrong,
        percentage: pct,
        rank: 0,
      };
      if (period.key) {
        createData.period_start = period.key;
      }

      try {
        await databases.createDocument(DB_ID, 'leaderboard', docId, createData);
      } catch (createErr) {
        console.error(`Failed to create leaderboard doc ${docId}:`, createErr);
      }
    }
  }
}
