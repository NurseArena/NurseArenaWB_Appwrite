import { databases } from '@/lib/appwrite/client';

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

    const attemptedQ = newCorrect + newWrong;
    const percentage = attemptedQ > 0 ? (newCorrect / attemptedQ) * 100 : 0;
    const docId = `${userId}_${examCode}_all_time`;

    try {
      await databases.getDocument(DB_ID, 'leaderboard', docId);
      await databases.updateDocument(DB_ID, 'leaderboard', docId, {
        marksEarned: newTotalMarksEarned,
        percentage: Math.round(percentage * 100) / 100,
        wrong: newWrong,
        totalMarksEarned: newTotalMarksEarned,
        displayName,
        photoURL,
      });
    } catch {
      await databases.createDocument(DB_ID, 'leaderboard', docId, {
        userId,
        exam_id: examCode,
        period_type: 'all_time',
        displayName,
        photoURL,
        marksEarned: newTotalMarksEarned,
        percentage: Math.round(percentage * 100) / 100,
        wrong: newWrong,
        totalMarksEarned: newTotalMarksEarned,
        rank: 0,
      });
    }
  } catch (err) {
    console.error('Failed to update stats:', err);
  }
}
