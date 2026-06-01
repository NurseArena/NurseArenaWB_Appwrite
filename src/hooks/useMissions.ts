'use client';
import { useState, useEffect, useCallback } from 'react';
import { databases } from '@/lib/appwrite/client';
import { Query, ID } from 'appwrite';
import { useAuthStore } from '@/store/authStore';
import type { Mission, UserMission } from '@/types/user';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export function useMissions() {
  const [missions, setMissions] = useState<(Mission & { progress?: number; completed?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((s) => s.user);

  const loadMissions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { documents: missionData } = await databases.listDocuments(
        DB_ID,
        'missions',
        [Query.limit(5)]
      );

      if (!missionData) return;

      const today = new Date().toISOString().split('T')[0];
      const { documents: userMissionData } = await databases.listDocuments(
        DB_ID,
        'user_missions',
        [
          Query.equal('userId', user.id),
          Query.limit(50),
        ]
      );

      const merged = missionData.map((m: Record<string, unknown>) => {
        const um = userMissionData?.find((u: Record<string, unknown>) => u.missionId === m.$id);
        return {
          id: m.$id as string,
          exam_id: m.examCode as string | undefined,
          title: m.title as string,
          description: m.description as string | undefined,
          xp_reward: m.xpReward as number,
          condition_type: m.type as string,
          condition_value: m.target as number,
          is_daily: false,
          progress: (um?.progress as number) ?? 0,
          completed: (um?.completed as boolean) ?? false,
        };
      });

      setMissions(merged);
    } catch (err) {
      console.error('Failed to load missions:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateProgress = useCallback(async (missionId: string, progress: number) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];

    await databases.createDocument(DB_ID, 'user_missions', ID.unique(), {
      userId: user.id,
      missionId,
      progress,
      completed: false,
      assignedDate: today,
    });

    loadMissions();
  }, [user, loadMissions]);

  useEffect(() => {
    let cancelled = false;
    const doLoad = async () => {
      try { if (!cancelled) await loadMissions(); } catch {}
    };
    doLoad();
    return () => { cancelled = true; };
  }, [loadMissions]);

  return { missions, loading, refresh: loadMissions, updateProgress };
}
