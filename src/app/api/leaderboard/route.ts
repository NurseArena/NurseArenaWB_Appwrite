import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/appwrite/server';
import { Query } from 'node-appwrite';
import { requireAuth } from '@/lib/appwrite/auth';

const querySchema = z.object({
  exam_id: z.string().min(1, 'exam_id is required'),
  period: z.enum(['daily', 'weekly', 'all_time']).default('all_time'),
});

export async function GET(request: Request) {
  try {
    const { error: authError } = await requireAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'Invalid query parameters';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }
    const { exam_id, period } = parsed.data;
    const DB_ID = process.env.APPWRITE_DATABASE_ID!;

    const { databases } = createAdminClient();
    const { documents } = await databases.listDocuments(DB_ID, 'leaderboard', [
      Query.equal('period_type', period),
      Query.equal('exam_id', exam_id),
      Query.orderDesc('marksEarned'),
      Query.limit(100),
    ]);

    return NextResponse.json({ entries: documents ?? [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
