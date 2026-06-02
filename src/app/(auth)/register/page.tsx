'use client';
import { useState, useEffect } from 'react';
import { account, databases } from '@/lib/appwrite/client';
import { ID, Permission, Role } from 'appwrite';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail } from 'lucide-react';
import { LogoIcon } from '@/components/LogoIcon';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

const ALLOWED_DOMAINS = [
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.in', 'hotmail.co.uk',
  'outlook.com', 'outlook.in', 'live.com', 'live.in',
  'yahoo.com', 'yahoo.in', 'yahoo.co.in',
  'rediffmail.com', 'icloud.com', 'me.com', 'protonmail.com', 'proton.me',
];

function isEmailAllowed(email: string) {
  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user) {
      const targetExams = (user.targetExams ?? []) as string[];
      const isOnboarded = targetExams.length > 0;
      if (user.isAdmin) {
        router.push('/admin');
      } else if (!isOnboarded) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
    }
  }, [user, router]);

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isEmailAllowed(email)) {
      setError('Please use a valid email (Gmail, Outlook, Yahoo, Rediffmail, etc.)');
      return;
    }

    setLoading(true);
    try {
      const newUser = await account.create(ID.unique(), email, password, name);
      try { await account.deleteSession('current'); } catch {}
      await account.createEmailPasswordSession(email, password);
      const userId = newUser.$id;

      try {
        await databases.createDocument(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
          'profiles',
          userId,
          {
            email,
            displayName: name || email,
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
      } catch (profileErr) {
        console.error('Register: profile create error', profileErr);
      }

      setLoading(false);
      router.push('/onboarding');
    } catch (err: any) {
      if (err?.type === 'user_already_exists') {
        setError('An account with this email already exists.');
      } else {
        setError(err?.message ?? 'Registration failed');
      }
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
          <h1 className="text-2xl font-bold text-ink">Start your journey</h1>
          <p className="text-sm text-ink-muted mt-1">Create an account to begin practicing</p>
        </div>

        <form onSubmit={handleEmailRegister} className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              placeholder="Priya Das"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="you@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="text-[10px] text-ink-muted">Use Gmail, Outlook, Yahoo, Rediffmail, iCloud, or ProtonMail</p>
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <p className="text-sm text-danger bg-danger/5 px-3 py-2 rounded-lg">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            <Mail size={18} />
            {loading ? 'Creating account...' : 'Sign up with Email'}
          </Button>
        </form>

        <p className="text-center text-sm text-ink-muted mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-bold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
