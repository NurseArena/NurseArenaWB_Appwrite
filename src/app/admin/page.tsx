'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { databases } from '@/lib/appwrite/client';
import { Query } from 'appwrite';
import { BookOpen, ClipboardList, BarChart3, CalendarDays, Upload, Users, Bell, GitBranch, Layers, FileText } from 'lucide-react';
import Link from 'next/link';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const QUIZ_REQUIRED = 50;

export default function AdminDashboard() {
  const [poolData, setPoolData] = useState<Record<string, { available: number; reserved: number; used: number; quizzes_possible: number }>>({});

  useEffect(() => {
    (async () => {
      const { documents: questions } = await databases.listDocuments(
        DB_ID,
        'questions',
        [Query.limit(5000)]
      );

      const counts = new Map<string, { available: number; reserved: number; used: number }>();
      for (const q of questions as unknown as { exam_code: string; quiz_pool_status: string }[]) {
        const code = q.exam_code ?? 'UNKNOWN';
        let entry = counts.get(code);
        if (!entry) { entry = { available: 0, reserved: 0, used: 0 }; counts.set(code, entry); }
        if (q.quiz_pool_status === 'available') entry.available++;
        else if (q.quiz_pool_status === 'reserved') entry.reserved++;
        else if (q.quiz_pool_status === 'used') entry.used++;
      }

      const map: Record<string, { available: number; reserved: number; used: number; quizzes_possible: number }> = {};
      for (const [code, c] of counts) {
        map[code] = { ...c, quizzes_possible: Math.floor(c.available / QUIZ_REQUIRED) };
      }
      setPoolData(map);
    })();
  }, []);

  const links = [
    { icon: Upload, label: 'Upload Questions', href: '/admin/questions', desc: 'One-click CSV/Excel upload' },
    { icon: BookOpen, label: 'Question Bank', href: '/admin/questions/bank', desc: 'Browse, edit, add single question' },
    { icon: CalendarDays, label: 'Quiz Management', href: '/admin/quizzes', desc: 'Create quizzes, weekly mock settings' },
    { icon: GitBranch, label: 'Exam Mapping', href: '/admin/exam-mapping', desc: 'View/Edit Exam → Subject → Topic tree' },
    { icon: ClipboardList, label: 'Schedule Events', href: '/admin/scheduler', desc: 'Mock tests and live quiz scheduling' },
    { icon: BarChart3, label: 'Analytics', href: '/admin/analytics', desc: 'Usage stats, charts, and reports' },
    { icon: Users, label: 'Users', href: '/admin/users', desc: 'Search, view scores, reset scores' },
    { icon: Bell, label: 'Notifications', href: '/admin/notifications', desc: 'Send to all / by exam / single user' },
    { icon: Layers, label: 'Topics', href: '/admin/topics', desc: 'Manage subject → topic hierarchy' },
    { icon: FileText, label: 'Mock Tests', href: '/admin/mock-tests', desc: 'Create and publish mock tests' },
  ];

  const poolColor = (available: number) => {
    if (available >= QUIZ_REQUIRED * 3) return { border: 'border-success/30', badge: 'success' as const, label: 'Healthy' };
    if (available >= QUIZ_REQUIRED) return { border: 'border-warning/30', badge: 'warning' as const, label: 'Low — add soon' };
    return { border: 'border-danger/30', badge: 'danger' as const, label: 'Cannot schedule' };
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <h1 className="text-3xl font-bold text-ink">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(poolData).map(([code, pool]) => {
          const color = poolColor(pool.available);
          return (
            <Card key={code} className={`p-4 border-2 ${color.border}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-ink">{code}</h3>
                <Badge variant={color.badge}>{pool.available >= QUIZ_REQUIRED ? '✓' : '⚠'} {color.label}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-2xl font-bold text-success">{pool.available}</p>
                  <p className="text-ink-muted">Available</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-warning">{pool.reserved}</p>
                  <p className="text-ink-muted">Reserved</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-ink-muted">{pool.used}</p>
                  <p className="text-ink-muted">Used</p>
                </div>
              </div>
              <p className="text-xs text-center mt-2 text-ink-muted">
                {pool.quizzes_possible > 0
                  ? `Can schedule ${pool.quizzes_possible} more quizzes`
                  : `Need ${QUIZ_REQUIRED - pool.available} more questions`}
              </p>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="p-6 hover:border-primary/30 transition-all cursor-pointer">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <link.icon size={24} className="text-primary" />
              </div>
              <h3 className="text-lg font-bold text-ink mb-1">{link.label}</h3>
              <p className="text-sm text-ink-muted">{link.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
