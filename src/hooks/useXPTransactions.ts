'use client';
import { useState, useCallback } from 'react';
import { databases } from '@/lib/appwrite/client';
import { useAuthStore } from '@/store/authStore';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export function useMarksHistory() {
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const awardMarks = useCallback(async (delta: number) => {
    if (!user) return;
    try {
      const newMarks = Math.max(0, (user.totalMarksEarned ?? 0) + delta);
      await databases.updateDocument(DB_ID, 'profiles', user.id, { totalMarksEarned: newMarks });
      setUser({ ...user, totalMarksEarned: newMarks });
    } catch (err) {
      console.error('Failed to award marks:', err);
    }
  }, [user, setUser]);

  return {
    loading,
    awardMarks,
  };
}
