import { databases } from '@/lib/appwrite/client';
import { Query, ID } from 'appwrite';
import type { Question } from '@/types/exam';
import type { AdminStats } from '@/types/leaderboard';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export async function bulkUploadQuestions(questions: Omit<Question, 'id' | 'created_at' | 'createdAt'>[]) {
  const uploaded: Question[] = [];
  const skipped: { row: Omit<Question, 'id' | 'created_at' | 'createdAt'>; reason: string }[] = [];
  const failed: { row: Omit<Question, 'id' | 'created_at' | 'createdAt'>; reason: string }[] = [];

  for (const question of questions) {
    try {
      const data = await databases.createDocument(
        DB_ID,
        'questions',
        ID.unique(),
        question
      );
      uploaded.push(data as unknown as Question);
    } catch (err: any) {
      if (err?.message?.includes('duplicate') || err?.type === 'document_already_exists') {
        skipped.push({ row: question, reason: 'Duplicate question' });
      } else {
        failed.push({ row: question, reason: err?.message ?? 'Unknown error' });
      }
    }
  }

  return { uploaded, skipped, failed, total: questions.length };
}

export async function fetchDuplicateQuestions(examCode?: string) {
  const queries = [
    Query.isNotNull('content_hash'),
    Query.limit(5000),
  ];
  if (examCode) queries.push(Query.equal('exam_code', examCode));

  const { documents } = await databases.listDocuments(
    DB_ID,
    'questions',
    queries
  );

  const hashCounts = new Map<string, number>();
  const hashIds = new Map<string, string[]>();
  for (const row of documents as unknown as { content_hash: string; $id: string }[]) {
    const h = row.content_hash;
    hashCounts.set(h, (hashCounts.get(h) ?? 0) + 1);
    const ids = hashIds.get(h) ?? [];
    ids.push(row.$id);
    hashIds.set(h, ids);
  }

  const duplicates: { content_hash: string; count: number; ids: string[] }[] = [];
  for (const [hash, count] of hashCounts) {
    if (count > 1) {
      duplicates.push({ content_hash: hash, count, ids: hashIds.get(hash) ?? [] });
    }
  }

  return duplicates;
}

export async function validateQuestionRow(row: Record<string, unknown>) {
  const errors: string[] = [];
  if (!row.question_text) errors.push('question_text is required');
  if (!row.option_a) errors.push('option_a is required');
  if (!row.option_b) errors.push('option_b is required');
  if (!row.option_c) errors.push('option_c is required');
  if (!row.option_d) errors.push('option_d is required');
  if (!row.correct_answer || !['a', 'b', 'c', 'd'].includes(String(row.correct_answer).toLowerCase())) {
    errors.push('correct_answer must be a/b/c/d');
  }
  if (row.difficulty && !['easy', 'medium', 'hard'].includes(String(row.difficulty).toLowerCase())) {
    errors.push('difficulty must be easy/medium/hard');
  }
  if (!row.exam_code) errors.push('exam_code is required');
  return errors;
}

export async function createQuestion(question: Omit<Question, 'id' | 'created_at' | 'createdAt'>) {
  const data = await databases.createDocument(
    DB_ID,
    'questions',
    ID.unique(),
    question
  );
  return data as unknown as Question;
}

export async function updateQuestion(id: string, updates: Partial<Question>) {
  const data = await databases.updateDocument(
    DB_ID,
    'questions',
    id,
    updates
  );
  return data as unknown as Question;
}

export async function softDeleteQuestion(id: string) {
  await databases.updateDocument(
    DB_ID,
    'questions',
    id,
    { archived: true }
  );
}

export async function fetchQuestionsAdmin(filters?: { exam_code?: string; difficulty?: string; search?: string }, limit = 50, offset = 0) {
  const queries = [
    Query.equal('archived', [false, null] as any),
    Query.limit(limit),
    Query.offset(offset),
  ];
  if (filters?.exam_code) queries.push(Query.equal('exam_code', filters.exam_code));
  if (filters?.difficulty) queries.push(Query.equal('difficulty', filters.difficulty));
  if (filters?.search) {
    // Appwrite doesn't have ilike, use contains as a workaround
    queries.push(Query.search('question', filters.search));
  }

  const { documents } = await databases.listDocuments(
    DB_ID,
    'questions',
    queries
  );
  return documents;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const { documents: users } = await databases.listDocuments(
    DB_ID,
    'profiles',
    [Query.limit(5000)]
  );

  const totalUsers = users.length;

  const perExam: Record<string, number> = {};
  (users as unknown as Record<string, unknown>[]).forEach((u: any) => {
    const exams = typeof u.targetExams === 'string'
      ? JSON.parse(u.targetExams || '[]')
      : u.targetExams ?? [];
    if (Array.isArray(exams)) {
      exams.forEach((ex: string) => {
        perExam[ex] = (perExam[ex] ?? 0) + 1;
      });
    }
  });

  return {
    totalRegisteredUsers: totalUsers,
    totalUsersPerExam: Object.entries(perExam).map(([exam, count]) => ({ exam, count })),
    dailyActiveUsers: [],
    averageScores: [],
    marksDistribution: [],
    topWrongQuestions: [],
  };
}
