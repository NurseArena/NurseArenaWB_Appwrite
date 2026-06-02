'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { account, databases } from '@/lib/appwrite/client';
import { useAuthStore } from '@/store/authStore';
import { useExamStore } from '@/store/examStore';
import type { Profile } from '@/types/user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setActiveExam = useExamStore((s) => s.setActiveExam);
  const initDone = useRef(false);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    (async () => {
      try {
        const authUser = await account.get();
        if (!authUser) {
          setUser(null);
          return;
        }

        let profile: any;
        try {
          profile = await databases.getDocument(
            process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
            'profiles',
            authUser.$id
          );
        } catch {
          profile = null;
        }

        if (profile) {
          const targetExams = typeof profile.targetExams === 'string'
            ? JSON.parse(profile.targetExams || '[]')
            : profile.targetExams ?? [];
          if (targetExams.length > 0) {
            setActiveExam(targetExams[0] as never);
          }
          setUser(profile);
        } else {
          setUser({
            id: authUser.$id,
            uid: authUser.$id,
            email: authUser.email ?? '',
            displayName: authUser.name ?? authUser.email?.split('@')[0] ?? 'User',
            targetExams: [],
            totalMarksEarned: 0,
            totalQuestionsAttempted: 0,
            totalCorrect: 0,
            totalWrong: 0,
            totalSkipped: 0,
            bestMockScore: 0,
            rapidFireUnlockedTier: 1,
            streakDays: 0,
            profileCompletePct: 0,
            isAdmin: false,
          } as Profile);
        }
      } catch {
        setUser(null);
      }
    })();
  }, [setUser, setActiveExam]);

  return children;
}
