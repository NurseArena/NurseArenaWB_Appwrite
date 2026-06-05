import { databases } from '@/lib/appwrite/client';
import { upsertLeaderboardEntries } from '@/services/leaderboard';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export async function updateStats(
  userId: string,
  displayName: string,
  photoURL: string | null,
  examCode: string,
  sessionMarksEarned: number,
  sessionTotalMarks: number,
  sessionCorrect: number,
  sessionWrong: number,
  sessionSkipped: number,
) {
  try {
    const profile = await databases.getDocument(DB_ID, 'profiles', userId) as Record<string, unknown>;
    const newTotalMarksEarned = (profile.totalMarksEarned as number ?? 0) + sessionMarksEarned;
    const newTotalAttempted = (profile.totalQuestionsAttempted as number ?? 0) + sessionTotalMarks;
    const newCorrect = (profile.totalCorrect as number ?? 0) + sessionCorrect;
    const newWrong = (profile.totalWrong as number ?? 0) + sessionWrong;
    const newSkipped = (profile.totalSkipped as number ?? 0) + sessionSkipped;

    await databases.updateDocument(DB_ID, 'profiles', userId, {
      totalMarksEarned: newTotalMarksEarned,
      totalQuestionsAttempted: newTotalAttempted,
      totalCorrect: newCorrect,
      totalWrong: newWrong,
      totalSkipped: newSkipped,
    });

    await upsertLeaderboardEntries(
      userId,
      examCode,
      displayName,
      photoURL,
      sessionMarksEarned,
      sessionCorrect,
      sessionWrong,
      newTotalMarksEarned,
      newCorrect,
      newWrong,
    );
  } catch (err) {
    console.error('Failed to update stats:', err);
  }
}
