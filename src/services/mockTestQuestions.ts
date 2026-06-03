import { databases } from '@/lib/appwrite/client';
import { Query, ID } from 'appwrite';
import type { MockTestQuestion } from '@/types/quiz';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const COLLECTION = 'mock_test_questions';

export async function createMockTestQuestion(data: Omit<MockTestQuestion, 'id'>) {
  const doc = await databases.createDocument(DB_ID, COLLECTION, ID.unique(), data);
  return doc as unknown as MockTestQuestion;
}

export async function getMockTestQuestions(mockTestId: string) {
  const { documents } = await databases.listDocuments(DB_ID, COLLECTION, [
    Query.equal('mock_test_id', mockTestId),
    Query.orderAsc('order_index'),
  ]);
  return documents as unknown as MockTestQuestion[];
}

export async function getNextMockTestNumber(examCode: string) {
  const { documents } = await databases.listDocuments(DB_ID, 'mock_tests', [
    Query.equal('exam_code', examCode),
    Query.limit(1),
    Query.orderDesc('serial_number'),
  ]);
  const highest = documents[0]?.serial_number ?? 0;
  return Number(highest) + 1;
}

export async function createMockTestWithQuestions(
  examCode: string,
  title: string,
  serialNumber: number,
  durationSeconds: number,
  questions: Omit<MockTestQuestion, 'id' | 'mock_test_id'>[]
) {
  const mockTest = await databases.createDocument(DB_ID, 'mock_tests', ID.unique(), {
    exam_code: examCode,
    title: title || `${examCode}_${serialNumber}`,
    serial_number: serialNumber,
    duration_seconds: durationSeconds,
    status: 'published',
    published_at: new Date().toISOString(),
  });

  const mockTestId = mockTest.$id;
  const created: MockTestQuestion[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = await createMockTestQuestion({
      mock_test_id: mockTestId,
      question: questions[i].question,
      option_a: questions[i].option_a,
      option_b: questions[i].option_b,
      option_c: questions[i].option_c,
      option_d: questions[i].option_d,
      correct: questions[i].correct,
      explanation: questions[i].explanation ?? '',
      order_index: i,
    });
    created.push(q);
  }

  return { mockTest, questions: created };
}
