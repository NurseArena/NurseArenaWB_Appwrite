import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/appwrite/server';
import { Query, ID } from 'node-appwrite';
import { getCurrentUser } from '@/lib/appwrite/auth';

const createQuizSchema = z.object({
  exam_code: z.string().min(1),
  type: z.enum(['mock','quiz','topicwise','rapid_fire','live','daily','pyq']),
  title: z.string().min(1),
  question_count: z.number().int().positive(),
  duration_seconds: z.number().int().positive().optional(),
});

async function requireAdmin(request: Request) {
  const user = await getCurrentUser(request.headers.get('cookie') || '');
  if (!user) {
    return { databases: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { databases } = createAdminClient();
  const profile = await databases
    .getDocument(process.env.APPWRITE_DATABASE_ID!, 'profiles', user.$id as string)
    .catch(() => null);

  if (!profile || !(profile as any).is_admin) {
    return { databases: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { databases, error: null };
}

export async function POST(request: Request) {
  try {
    const { databases, error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const body = await request.json();
    const parsed = createQuizSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const data = await databases.createDocument(
      process.env.APPWRITE_DATABASE_ID!,
      'quizzes',
      ID.unique(),
      parsed.data
    );

    return NextResponse.json({ quiz: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { databases, error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const DB_ID = process.env.APPWRITE_DATABASE_ID!;
    const { documents } = await databases.listDocuments(DB_ID, 'quizzes', [
      Query.orderDesc('$createdAt'),
      Query.limit(100),
    ]);

    return NextResponse.json({ quizzes: documents ?? [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
