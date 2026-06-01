import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite/server';
import { Query } from 'node-appwrite';
import { requireAuth } from '@/lib/appwrite/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { userId, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const { sessionId } = await params;
    const { databases } = createAdminClient();
    const DB_ID = process.env.APPWRITE_DATABASE_ID!;

    const session = await databases.getDocument(DB_ID, 'quiz_sessions', sessionId).catch(() => null);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if ((session as any).userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { documents: answers } = await databases.listDocuments(
      DB_ID,
      'session_answers',
      [
        Query.equal('sessionId', sessionId),
        Query.orderAsc('orderIndex'),
      ]
    );

    return NextResponse.json({ session, answers: answers ?? [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
