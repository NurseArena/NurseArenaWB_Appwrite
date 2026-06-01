'use client';
import { useState, useCallback } from 'react';
import { databases } from '@/lib/appwrite/client';
import { Query } from 'appwrite';
import type { MockTestEvent } from '@/types/user';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export function useMockTest() {
  const [upcomingTests, setUpcomingTests] = useState<(MockTestEvent & { exams?: { name: string; code: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUpcoming = useCallback(async (examId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const queries = [
        Query.greaterThan('scheduled_at', new Date().toISOString()),
        Query.orderAsc('scheduled_at'),
      ];
      if (examId) queries.push(Query.equal('exam_code', examId));

      const { documents } = await databases.listDocuments(
        DB_ID,
        'mock_test_events',
        queries
      );
      setUpcomingTests(documents as unknown as (MockTestEvent & { exams?: { name: string; code: string } })[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tests');
    } finally {
      setLoading(false);
    }
  }, []);

  const isWithinWindow = (scheduledAt: string, durationMin: number) => {
    const now = Date.now();
    const start = new Date(scheduledAt).getTime();
    const end = start + durationMin * 60000;
    return now >= start && now <= end;
  };

  const getCountdown = (scheduledAt: string) => {
    const diff = new Date(scheduledAt).getTime() - Date.now();
    if (diff <= 0) return null;
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  };

  return {
    upcomingTests,
    loading,
    error,
    fetchUpcoming,
    isWithinWindow,
    getCountdown,
  };
}
