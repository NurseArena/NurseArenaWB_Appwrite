import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/appwrite/server';
import { Query, ID } from 'node-appwrite';
import { getCurrentUser } from '@/lib/appwrite/auth';

const createQuestionSchema = z.object({
  exam_code: z.string().min(1),
  question: z.string().min(1),
  option_a: z.string().min(1),
  option_b: z.string().min(1),
  option_c: z.string().min(1),
  option_d: z.string().min(1),
  correct: z.enum(['A','B','C','D']),
  subject_name: z.string().optional(),
  topic: z.string().optional(),
  difficulty: z.enum(['easy','medium','hard']).optional(),
  explanation: z.string().optional(),
  is_pyq: z.boolean().optional(),
  pyq_year: z.number().int().optional(),
});

const updateQuestionSchema = z.object({
  question: z.string().min(1).optional(),
  option_a: z.string().min(1).optional(),
  option_b: z.string().min(1).optional(),
  option_c: z.string().min(1).optional(),
  option_d: z.string().min(1).optional(),
  correct: z.enum(['A','B','C','D']).optional(),
  explanation: z.string().optional(),
  difficulty: z.enum(['easy','medium','hard']).optional(),
});

const querySchema = z.object({
  search: z.string().optional(),
  difficulty: z.string().optional(),
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
    const parsed = createQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const data = await databases.createDocument(
      process.env.APPWRITE_DATABASE_ID!,
      'questions',
      ID.unique(),
      parsed.data
    );

    return NextResponse.json({ questions: [data] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { databases, error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

    const DB_ID = process.env.APPWRITE_DATABASE_ID!;
    const queries = [
      Query.equal('archived', [false, null] as any),
      Query.orderDesc('$createdAt'),
      Query.limit(100),
    ];

    if (parsed.success) {
      if (parsed.data.search) queries.push(Query.search('question', parsed.data.search));
      if (parsed.data.difficulty) queries.push(Query.equal('difficulty', parsed.data.difficulty));
    }

    const { documents } = await databases.listDocuments(DB_ID, 'questions', queries);
    return NextResponse.json({ questions: documents ?? [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { databases, error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Valid question id is required' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const data = await databases.updateDocument(
      process.env.APPWRITE_DATABASE_ID!,
      'questions',
      id,
      parsed.data
    );

    return NextResponse.json({ question: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { databases, error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Valid question id is required' }, { status: 400 });
    }

    await databases.updateDocument(
      process.env.APPWRITE_DATABASE_ID!,
      'questions',
      id,
      { archived: true }
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
