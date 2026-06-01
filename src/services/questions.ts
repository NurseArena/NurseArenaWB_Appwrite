import { databases } from '@/lib/appwrite/client';
import { Query } from 'appwrite';
import type { Question } from '@/types/exam';

export async function fetchQuestions(examCode: string, subjectName?: string, limit = 20) {
  const queries = [
    Query.equal('exam_code', examCode),
    Query.equal('archived', [false, null] as any),
    Query.limit(limit),
  ];
  if (subjectName) queries.push(Query.equal('subject_name', subjectName));

  const { documents } = await databases.listDocuments(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    'questions',
    queries
  );
  return documents as unknown as Question[];
}

export async function fetchQuestionsByIds(ids: string[]) {
  const { documents } = await databases.listDocuments(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    'questions',
    [
      Query.equal('$id', ids),
    ]
  );
  return documents as unknown as Question[];
}

export async function fetchPYQs(examCode: string, year?: number) {
  const queries = [
    Query.equal('exam_code', examCode),
    Query.equal('is_pyq', true),
    Query.equal('archived', [false, null] as any),
  ];
  if (year) queries.push(Query.equal('pyq_year', year));

  const { documents } = await databases.listDocuments(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    'questions',
    queries
  );
  return documents as unknown as Question[];
}
