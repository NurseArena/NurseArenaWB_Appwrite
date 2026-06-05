'use client';
import { useState, useEffect } from 'react';
import { databases } from '@/lib/appwrite/client';
import { Query } from 'appwrite';
import { useAuthStore } from '@/store/authStore';
import type { QuizSessionRecord } from '@/types/quiz';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export function useSessionHistory(type?: string) {
  const user = useAuthStore((s) => s.user);
  const [sessions, setSessions] = useState<QuizSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const queries: any[] = [
          Query.equal('userId', user.id),
          Query.equal('status', 'submitted'),
          Query.orderDesc('submittedAt'),
          Query.limit(100),
        ];
        if (type) queries.push(Query.equal('type', type));
        const { documents } = await databases.listDocuments(DB_ID, 'quiz_sessions', queries);
        if (!cancelled) setSessions(documents as unknown as QuizSessionRecord[]);
      } catch {
        if (!cancelled) setSessions([]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, type]);

  return { sessions, loading };
}

export function useCompletedMockTests() {
  const { sessions, loading } = useSessionHistory('mock_test');
  return {
    completedIds: new Set(sessions.map((s) => s.reference_id ?? s.quizId)),
    sessions,
    loading,
  };
}

export function useCompletedRapidFire() {
  const { sessions, loading } = useSessionHistory('rapid_fire');
  return { sessions, loading, count: sessions.length };
}

export function useCompletedTopicwise() {
  const { sessions, loading } = useSessionHistory('topicwise');
  return { sessions, loading };
}

export function useCompletedPYQ() {
  const { sessions, loading } = useSessionHistory('pyq');
  return { sessions, loading };
}
