import { NextResponse } from 'next/server';

type AuthResult = { userId: string; error: null } | { userId: null; error: NextResponse };

export async function getCurrentUser(cookieHeader: string) {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;

  const response = await fetch(`${endpoint}/account`, {
    headers: {
      'X-Appwrite-Project': projectId,
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
  });

  if (!response.ok) return null;
  return response.json() as Promise<Record<string, unknown>>;
}

export async function requireAuth(request: Request): Promise<AuthResult> {
  const user = await getCurrentUser(request.headers.get('cookie') || '');
  if (!user || !user.$id) {
    return { userId: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { userId: user.$id as string, error: null };
}
