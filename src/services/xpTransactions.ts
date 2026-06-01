import { databases } from '@/lib/appwrite/client';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export async function awardMarks(userId: string, delta: number) {
  try {
    const profile = await databases.getDocument(
      DB_ID,
      'profiles',
      userId
    ) as unknown as { totalMarksEarned: number };

    const newMarks = Math.max(0, (profile.totalMarksEarned ?? 0) + delta);
    await databases.updateDocument(
      DB_ID,
      'profiles',
      userId,
      { totalMarksEarned: newMarks }
    );
  } catch {
    // Profile not found
  }
}
