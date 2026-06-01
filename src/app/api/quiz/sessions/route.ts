import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/appwrite/server';
import { Query } from 'node-appwrite';
import { requireAuth } from '@/lib/appwrite/auth';

const querySchema = z.object({
  exam_id: z.string().optional(),
  type: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: Request) {
  try {
    const { userId, error: authError } = await requireAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }
    const { limit, offset } = parsed.data;

    const { databases } = createAdminClient();
    const DB_ID = process.env.APPWRITE_DATABASE_ID!;

    const queries = [
      Query.equal('userId', userId),
      Query.equal('status', 'submitted'),
      Query.orderDesc('$createdAt'),
      Query.limit(limit),
      Query.offset(offset),
    ];

    const { documents: sessions } = await databases.listDocuments(DB_ID, 'quiz_sessions', queries);

    return NextResponse.json({ sessions });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
