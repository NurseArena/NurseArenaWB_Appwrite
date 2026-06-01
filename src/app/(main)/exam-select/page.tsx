'use client';
import { useRouter } from 'next/navigation';
import { useExamStore } from '@/store/examStore';
import { databases } from '@/lib/appwrite/client';
import { useAuthStore, normalizeProfile } from '@/store/authStore';
import { ExamSelector } from '@/components/exam/ExamSelector';
import { motion } from 'framer-motion';
import { LogoIcon } from '@/components/LogoIcon';
import type { ExamCode } from '@/lib/exam-config';

export default function ExamSelectPage() {
  const router = useRouter();
  const setActiveExam = useExamStore((s) => s.setActiveExam);
  const user = useAuthStore((s) => s.user);

  const handleSelect = async (code: ExamCode) => {
    setActiveExam(code);
    if (user) {
      try {
        await databases.updateDocument(
          process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
          'profiles',
          user.id,
          { targetExams: JSON.stringify([code]) }
        );
      } catch {
        // Profile might not exist yet
      }
    }
    router.push('/dashboard');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
          <LogoIcon size={56} />
        </div>
        <h1 className="text-3xl font-bold text-ink">Choose Your Exam</h1>
        <p className="text-ink-muted mt-2">
          Select the exam you&apos;re preparing for
        </p>
      </div>
      <ExamSelector onSelect={handleSelect} />
    </motion.div>
  );
}
