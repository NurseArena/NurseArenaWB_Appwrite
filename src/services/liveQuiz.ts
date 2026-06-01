import { databases } from '@/lib/appwrite/client';
import { Query, ID } from 'appwrite';
import type { LiveQuizEvent, QuizResult, QuizAnswer } from '@/types/user';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export async function fetchUpcomingLiveQuizzes(examId?: string) {
  const queries = [
    Query.equal('status', ['scheduled', 'live']),
    Query.orderAsc('starts_at'),
  ];
  if (examId) queries.push(Query.equal('exam_code', examId));

  const { documents } = await databases.listDocuments(
    DB_ID,
    'live_quiz_events',
    queries
  );
  return documents as unknown as LiveQuizEvent[];
}

export async function getLiveQuizState(quizEventId: string) {
  const data = await databases.getDocument(
    DB_ID,
    'live_quiz_events',
    quizEventId
  );
  return data as unknown as LiveQuizEvent | null;
}

export async function joinLiveQuiz(quizEventId: string, userId: string) {
  const data = await databases.createDocument(
    DB_ID,
    'quiz_results',
    ID.unique(),
    {
      quizEventId,
      userId,
      score: 0,
      correctCount: 0,
      totalLatencyMs: 0,
      joinedAtIndex: 0,
      disconnectionFlag: false,
    }
  );
  return data as unknown as QuizResult;
}

export async function submitQuizAnswer(answer: Omit<QuizAnswer, 'id' | 'submitted_at'>) {
  const data = await databases.createDocument(
    DB_ID,
    'quiz_answers',
    ID.unique(),
    answer
  );
  return data as unknown as QuizAnswer;
}

export async function fetchQuizLeaderboard(quizEventId: string) {
  const { documents } = await databases.listDocuments(
    DB_ID,
    'quiz_results',
    [
      Query.equal('quizEventId', quizEventId),
      Query.orderDesc('score'),
      Query.orderDesc('correctCount'),
      Query.orderAsc('totalLatencyMs'),
      Query.limit(50),
    ]
  );
  return documents;
}

export async function fetchQuizQuestions(quizEventId: string) {
  const quiz = await databases.getDocument(
    DB_ID,
    'live_quiz_events',
    quizEventId
  ) as unknown as { question_set_id?: string } | null;

  if (!quiz?.question_set_id) return [];

  const { documents } = await databases.listDocuments(
    DB_ID,
    'quiz_questions',
    [
      Query.equal('quiz_id', quiz.question_set_id),
      Query.orderAsc('order_index'),
    ]
  );
  return documents;
}
