import { databases } from '@/lib/appwrite/client';
import { Query, ID } from 'appwrite';
import type { Attempt } from '@/types/quiz';
import type { QuizAttempt } from '@/types/user';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export async function logAttempt(attempt: Omit<Attempt, 'id' | 'attempted_at'>) {
  const data = await databases.createDocument(
    DB_ID,
    'attempts',
    ID.unique(),
    attempt
  );
  return data as unknown as Attempt;
}

export async function fetchUserAttempts(userId: string, limit = 100) {
  const { documents } = await databases.listDocuments(
    DB_ID,
    'attempts',
    [
      Query.equal('userId', userId),
      Query.limit(limit),
      Query.orderDesc('$createdAt'),
    ]
  );
  return documents;
}

export async function getUserStats(userId: string) {
  const { documents: allAttempts } = await databases.listDocuments(
    DB_ID,
    'attempts',
    [
      Query.equal('userId', userId),
      Query.limit(5000),
    ]
  );

  const total = allAttempts.length;
  const correct = allAttempts.filter((a: any) => a.isCorrect).length;

  return {
    totalAttempts: total,
    correctAnswers: correct,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
  };
}

export async function saveQuizAttempt(attempt: Omit<QuizAttempt, 'id'>) {
  const dbRow: Record<string, unknown> = {
    userId: attempt.uid,
    quizId: attempt.quizId,
    attemptNumber: attempt.attemptNumber,
    examCode: attempt.examId,
    startedAt: attempt.startedAt,
    submittedAt: attempt.completedAt,
    totalMarks: attempt.totalMarks,
    score: attempt.marksEarned,
    percentage: attempt.percentage,
    correctCount: attempt.correct,
    wrongCount: attempt.wrong,
    totalSkipped: attempt.skipped,
    negativePenalty: attempt.negativePenalty,
    categoryIAttempts: attempt.categoryIAttempts,
    categoryIIAttempts: attempt.categoryIIAttempts,
    subjectBreakdown: attempt.subjectBreakdown,
    isLiveAttempt: attempt.isLiveAttempt,
  };
  const data = await databases.createDocument(
    DB_ID,
    'quiz_sessions',
    ID.unique(),
    dbRow
  );
  return data as unknown as QuizAttempt;
}

export async function fetchQuizAttempts(userId: string, examCode?: string, limit = 20) {
  const queries = [
    Query.equal('userId', userId),
    Query.limit(limit),
    Query.orderDesc('$createdAt'),
  ];
  if (examCode) queries.push(Query.equal('examCode', examCode));

  const { documents } = await databases.listDocuments(
    DB_ID,
    'quiz_sessions',
    queries
  );
  return documents as unknown as QuizAttempt[];
}
