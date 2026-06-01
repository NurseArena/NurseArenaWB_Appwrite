import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/appwrite/server';
import { ID } from 'node-appwrite';
import { requireAuth } from '@/lib/appwrite/auth';

const submitSchema = z.object({
  questionId: z.string().min(1),
  selectedOption: z.string().nullable(),
  isCorrect: z.boolean(),
  timeTakenMs: z.number().int().positive(),
  sessionId: z.string().optional(),
  orderIndex: z.number().int().optional(),
  marksAwarded: z.number().optional(),
});

export async function POST(request: Request) {
  try {
    const { userId, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const body = await request.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const { questionId, selectedOption, isCorrect, timeTakenMs, sessionId, orderIndex, marksAwarded } = parsed.data;

    const { databases } = createAdminClient();
    const DB_ID = process.env.APPWRITE_DATABASE_ID!;

    const attempt = await databases.createDocument(DB_ID, 'attempts', ID.unique(), {
      userId,
      questionId,
      selectedOption,
      isCorrect,
      timeTakenMs,
    });

    if (sessionId) {
      await databases.createDocument(DB_ID, 'session_answers', ID.unique(), {
        sessionId,
        userId,
        questionId,
        orderIndex: orderIndex ?? 0,
        selectedOption,
        isCorrect,
        marksAwarded: marksAwarded,
        timeTakenMs,
        answeredAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ attempt, marksDelta: isCorrect ? (marksAwarded ?? 1.0) : (marksAwarded ?? -0.25) });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
