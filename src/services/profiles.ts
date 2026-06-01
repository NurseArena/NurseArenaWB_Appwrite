import { account, databases } from '@/lib/appwrite/client';
import { Query } from 'appwrite';
import type { Profile } from '@/types/user';

export async function getProfile(userId: string) {
  try {
    const authUser = await account.get();
    if (!authUser || authUser.$id !== userId) {
      throw new Error('Unauthorized');
    }
  } catch {
    throw new Error('Unauthorized');
  }
  const data = await databases.getDocument(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    'profiles',
    userId
  );
  return data as unknown as Profile | null;
}

export async function updateProfile(updates: Partial<Profile>) {
  const authUser = await account.get();
  if (!authUser) throw new Error('Unauthorized');
  const data = await databases.updateDocument(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    'profiles',
    authUser.$id,
    updates
  );
  return data as unknown as Profile;
}

export async function checkAndUpdateStreak(userId: string): Promise<Partial<Profile> | null> {
  const authUser = await account.get();
  if (!authUser || authUser.$id !== userId) {
    throw new Error('Unauthorized');
  }
  const profile = await databases.getDocument(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    'profiles',
    userId
  ) as unknown as { streakDays: number; lastLoginAt: string } | null;

  if (!profile) return null;

  const today = new Date().toISOString().split('T')[0];
  const lastLogin = profile.lastLoginAt;
  let newStreak = profile.streakDays ?? 0;

  if (lastLogin === today) return profile;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (lastLogin === yesterday) {
    newStreak += 1;
  } else {
    newStreak = 1;
  }

  const data = await databases.updateDocument(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    'profiles',
    userId,
    {
      streakDays: newStreak,
      lastLoginAt: today,
    }
  );
  return data as unknown as Partial<Profile>;
}

export async function manageUser(userId: string, updates: Record<string, unknown>) {
  const authUser = await account.get();
  if (!authUser) throw new Error('Unauthorized');
  const profile = await databases.getDocument(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    'profiles',
    authUser.$id
  ) as unknown as { is_admin: boolean };
  if (!profile?.is_admin) throw new Error('Forbidden: admin-only action');
  const data = await databases.updateDocument(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    'profiles',
    userId,
    updates
  );
  return data as unknown as Profile | null;
}

export async function fetchAllUsers(limit = 1000, offset = 0) {
  const result = await databases.listDocuments(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    'profiles',
    [
      Query.limit(limit),
      Query.offset(offset),
    ]
  );
  return result.documents as unknown as Profile[];
}
