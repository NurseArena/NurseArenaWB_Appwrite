import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/appwrite/server';
import { Query, ID } from 'node-appwrite';
import { requireAuth } from '@/lib/appwrite/auth';

const startQuizSchema = z.object({
  quizId: z.string().min(1),
  subjectId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const { userId, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const parsed = startQuizSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { quizId } = parsed.data;
    const { databases } = createAdminClient();
    const DB_ID = process.env.APPWRITE_DATABASE_ID!;

    const quiz = await databases.getDocument(DB_ID, 'quizzes', quizId).catch(() => null);
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const { documents: quizQuestions } = await databases.listDocuments(
      DB_ID,
      'quiz_questions',
      [
        Query.equal('quiz_id', quizId),
        Query.orderAsc('order_index'),
      ]
    );

    let questions = quizQuestions ?? [];

    if (!questions.length) {
      const count = (quiz as any).question_count || 10;
      const queries = [Query.equal('archived', [false, null] as any), Query.limit(count)];
      if ((quiz as any).exam_code) queries.push(Query.equal('exam_code', (quiz as any).exam_code));
      const { documents: randomQ } = await databases.listDocuments(DB_ID, 'questions', queries);
      if (randomQ?.length) {
        const shuffled = [...randomQ].sort(() => Math.random() - 0.5);
        questions = shuffled.slice(0, count) as any;
      }
    }

    const questionCount = questions.length;
    const maxScore = questionCount;

    const session = await databases.createDocument(DB_ID, 'quiz_sessions', ID.unique(), {
      quizId,
      userId,
      totalQuestions: questionCount,
      maxScore,
      status: 'active',
      startedAt: new Date().toISOString(),
    });

    return NextResponse.json({ questions, session });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
