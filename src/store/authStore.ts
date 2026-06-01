import { create } from 'zustand';
import type { Profile } from '@/types/user';

export function normalizeProfile(user: any): Profile | null {
  if (!user) return null;
  return {
    id: user.$id ?? user.id ?? user.uid ?? '',
    uid: user.$id ?? user.id ?? user.uid ?? '',
    email: user.email ?? '',
    displayName: user.displayName ?? user.name ?? user.email?.split('@')[0] ?? 'Student',
    photoURL: user.photoURL ?? null,
    phone: user.phone ?? '',
    targetExams: typeof user.targetExams === 'string'
      ? JSON.parse(user.targetExams || '[]')
      : user.targetExams ?? [],
    jemasSubCourse: user.jemasSubCourse ?? '',
    currentStage: user.currentStage ?? 'Student',
    institution: user.institution ?? '',
    district: user.district ?? '',
    joinedAt: user.$createdAt ?? null,
    totalMarksEarned: Number(user.totalMarksEarned ?? 0),
    totalQuestionsAttempted: Number(user.totalQuestionsAttempted ?? 0),
    totalCorrect: Number(user.totalCorrect ?? 0),
    totalWrong: Number(user.totalWrong ?? 0),
    totalSkipped: Number(user.totalSkipped ?? 0),
    bestMockScore: Number(user.bestMockScore ?? 0),
    rapidFireUnlockedTier: Number(user.rapidFireUnlockedTier ?? 1),
    streakDays: Number(user.streakDays ?? 0),
    lastLoginAt: user.$updatedAt ?? null,
    profileCompletePct: Number(user.profileCompletePct ?? 0),
    isAdmin: user.is_admin ?? false,
  };
}

interface AuthState {
  user: Profile | null;
  isLoading: boolean;
  setUser: (user: any) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  setUser: (user) => set({ user: normalizeProfile(user), isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ user: null, isLoading: false }),
}));

