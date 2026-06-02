'use client';
import { useState } from 'react';
import { account, databases } from '@/lib/appwrite/client';
import { Permission, Role } from 'appwrite';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import type { Profile } from '@/types/user';
import { Mail } from 'lucide-react';
import { LogoIcon } from '@/components/LogoIcon';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

async function getOrCreateProfile(userId: string, user: any) {
  try {
    return await databases.getDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      'profiles',
      userId
    );
  } catch (err: any) {
    if (err?.code !== 404) throw err;
  }
  try {
    return await databases.createDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      'profiles',
      userId,
      {
        email: user.email ?? '',
        displayName: user.name ?? user.email?.split('@')[0] ?? 'Student',
        targetExams: JSON.stringify([]),
        totalMarksEarned: 0,
        totalQuestionsAttempted: 0,
        totalCorrect: 0,
        totalWrong: 0,
        totalSkipped: 0,
        rapidFireUnlockedTier: 1,
        streakDays: 0,
        profileCompletePct: 0,
      },
      [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ]
    );
  } catch (err: any) {
    if (err?.code !== 409) throw err;
    // Race condition: doc was created between get and create — fetch it
    return await databases.getDocument(
      process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
      'profiles',
      userId
    );
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      try {
        await account.get();
        await account.deleteSession('current');
      } catch { /* no active session — proceed */ }
      await account.createEmailPasswordSession(email, password);
      const user = await account.get();
      const userId = user.$id;

      // Mirror session to cookie so middleware can read it
      const session = await account.getSession('current');
      document.cookie = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}=${session.secret}; path=/; SameSite=Lax`;

      const profile: any = await getOrCreateProfile(userId, user);
      if (!profile) {
        setError('Could not load profile.');
        setLoading(false);
        return;
      }

      const targetExams = typeof profile.targetExams === 'string'
        ? JSON.parse(profile.targetExams || '[]')
        : profile.targetExams ?? [];
      const isOnboarded = targetExams.length > 0;
      const isAdmin = profile.is_admin ?? false;
      setUser(profile);
      setLoading(false);

      if (isAdmin) {
        router.push('/admin');
      } else if (!isOnboarded) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Login: caught error', err);
      setError(err?.message ?? 'Invalid email or password');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
            <LogoIcon size={56} />
          </div>
          <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
          <p className="text-sm text-ink-muted mt-1">Log in to continue your streak</p>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-danger bg-danger/5 px-3 py-2 rounded-lg">{error}</p>
          )}

          {!process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT && (
            <div className="text-xs text-ink-muted bg-danger/5 px-3 py-2 rounded-lg space-y-1">
              <p className="font-bold text-danger">⚠ Setup Required</p>
              <p>Set <code className="bg-surface px-1 rounded">NEXT_PUBLIC_APPWRITE_ENDPOINT</code> &amp; <code className="bg-surface px-1 rounded">NEXT_PUBLIC_APPWRITE_PROJECT_ID</code> in <code className="bg-surface px-1 rounded">.env</code> to use the app.</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            <Mail size={18} />
            {loading ? 'Logging in...' : 'Log in with Email'}
          </Button>
        </form>

        <p className="text-center text-sm text-ink-muted mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-primary font-bold hover:underline">
            Sign up
          </Link>
        </p>


      </div>
    </div>
  );
}
