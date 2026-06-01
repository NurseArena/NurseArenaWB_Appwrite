import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite/server';
import { Query } from 'node-appwrite';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const userId = searchParams.get('userId');
  const secret = searchParams.get('secret');

  if (!userId || !secret) {
    return NextResponse.redirect(new URL('/login', origin));
  }

  try {
    const { users, databases } = createAdminClient();
    const user = await users.get(userId);

    let profile: any;
    try {
      profile = await databases.getDocument(
        process.env.APPWRITE_DATABASE_ID!,
        'profiles',
        userId
      );
    } catch {
      profile = null;
    }

    if (!profile) {
      await databases.createDocument(
        process.env.APPWRITE_DATABASE_ID!,
        'profiles',
        userId,
        {
          email: user.email ?? '',
          displayName: user.name ?? user.email?.split('@')[0] ?? 'Student',
          targetExams: JSON.stringify([]),
          totalMarksEarned: 0,
          totalQuestionsAttempted: 0,
          totalCorrect: 0,
          totalWrong: 0,
          totalSkipped: 0,
          rapidFireUnlockedTier: 1,
          streakDays: 0,
          profileCompletePct: 0,
        }
      );

      return NextResponse.redirect(new URL('/onboarding', origin));
    }

    const targetExams = typeof profile.targetExams === 'string'
      ? JSON.parse(profile.targetExams || '[]')
      : profile.targetExams ?? [];

    if (targetExams.length === 0) {
      return NextResponse.redirect(new URL('/onboarding', origin));
    }

    return NextResponse.redirect(new URL('/dashboard', origin));
  } catch {
    return NextResponse.redirect(new URL('/login?error=auth_callback_failed', origin));
  }
}
