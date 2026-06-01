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
