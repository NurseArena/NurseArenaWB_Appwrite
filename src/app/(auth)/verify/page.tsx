'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { account } from '@/lib/appwrite/client';
import { LogoIcon } from '@/components/LogoIcon';
import Link from 'next/link';

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const userId = searchParams.get('userId');
    const secret = searchParams.get('secret');

    if (!userId || !secret) {
      setStatus('error');
      setErrorMsg('Invalid verification link.');
      return;
    }

    (async () => {
      try {
        await account.updateVerification(userId, secret);
        setStatus('success');
        setTimeout(() => router.push('/login'), 3000);
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err?.message ?? 'Verification failed. The link may have expired.');
      }
    })();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto">
          <LogoIcon size={56} />
        </div>

        {status === 'verifying' && (
          <>
            <h1 className="text-2xl font-bold text-ink">Verifying your email...</h1>
            <p className="text-sm text-ink-muted">Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className="text-2xl font-bold text-green-600">Email verified!</h1>
            <p className="text-sm text-ink-muted">
              Your email has been verified successfully. Redirecting to login...
            </p>
            <Link href="/login" className="block text-primary font-bold hover:underline text-sm">
              Go to login
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-2xl font-bold text-danger">Verification failed</h1>
            <p className="text-sm text-ink-muted">{errorMsg}</p>
            <Link href="/login" className="block text-primary font-bold hover:underline text-sm">
              Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <p className="text-ink-muted">Loading...</p>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
