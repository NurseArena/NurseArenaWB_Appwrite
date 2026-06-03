'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { databases } from '@/lib/appwrite/client';
import { Query, ID } from 'appwrite';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Upload } from 'lucide-react';
import Link from 'next/link';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export default function AdminMockTestsPage() {
  const [mockTests, setMockTests] = useState<Record<string, unknown>[]>([]);
  const [examCode, setExamCode] = useState('JENPAS_UG_P1');
  const [title, setTitle] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [durationMins, setDurationMins] = useState('120');
  const [status, setStatus] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { documents } = await databases.listDocuments(
          DB_ID,
          'mock_tests',
          [Query.orderAsc('serial_number'), Query.limit(100)]
        );
        if (!cancelled && documents) setMockTests(documents as Record<string, unknown>[]);
      } catch {
        // mock_tests collection may not exist
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const handleCreate = async () => {
    setStatus('');
    try {
      const { error } = await databases.createDocument(
        DB_ID,
        'mock_tests',
        ID.unique(),
        {
          exam_code: examCode,
          title: title || `Mock Test ${serialNumber}`,
          serial_number: parseInt(serialNumber),
          duration_seconds: parseInt(durationMins) * 60,
        }
      ).catch(e => ({ error: e }));

      setStatus(`Mock Test created!`);
      setTitle('');
      setSerialNumber('');
      setRefreshKey(k => k + 1);
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handlePublish = async (id: string) => {
    await databases.updateDocument(DB_ID, 'mock_tests', id, {
      status: 'published',
      published_at: new Date().toISOString(),
    });
    setRefreshKey(k => k + 1);
  };

  const handleArchive = async (id: string) => {
    await databases.updateDocument(DB_ID, 'mock_tests', id, { status: 'archived' });
    setRefreshKey(k => k + 1);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-ink">Mock Tests</h1>
        <Link href="/admin/mock-tests/upload">
          <Button><Upload size={16} /> Upload CSV</Button>
        </Link>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="font-semibold text-lg">Create New Mock Test</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink">Exam</label>
            <Select value={examCode} onChange={(e) => setExamCode(e.target.value)}>
              <option value="JENPAS_UG_P1">JENPAS (UG) — Paper I</option>
              <option value="JENPAS_UG_P2">JENPAS (UG) — Paper II</option>
              <option value="ANM_GNM">ANM/GNM</option>
              <option value="JEPBN">JEPBN 2026</option>
              <option value="JEMSCN">JEMScN 2026</option>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink">Serial Number</label>
            <Input type="number" placeholder="e.g. 1" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink">Title (optional)</label>
            <Input placeholder="Mock Test 1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink">Duration (minutes)</label>
            <Input type="number" value={durationMins} onChange={(e) => setDurationMins(e.target.value)} />
          </div>
        </div>
        <Button onClick={handleCreate}><Plus size={16} /> Create Mock Test</Button>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold text-lg">All Mock Tests</h2>
        {mockTests.length === 0 ? (
          <p className="text-sm text-ink-muted italic">No mock tests created yet.</p>
        ) : (
          mockTests.map((mt) => (
            <Card key={mt.$id as string} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-ink">{mt.title as string}</p>
                <p className="text-xs text-ink-muted">
                  {mt.exam_code as string ?? ''} &middot; Serial #{mt.serial_number as string}
                  &middot; {Math.round(Number(mt.duration_seconds) / 60)} min
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={mt.status === 'published' ? 'success' : mt.status === 'draft' ? 'warning' : 'default'}>
                  {mt.status as string}
                </Badge>
                {mt.status === 'draft' && (
                  <Button size="sm" onClick={() => handlePublish(mt.$id as string)}>Publish</Button>
                )}
                {mt.status === 'published' && (
                  <Button size="sm" variant="ghost" onClick={() => handleArchive(mt.$id as string)}>
                    Archive
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {status && (
        <p className={`text-sm ${status.startsWith('Error') ? 'text-danger' : 'text-success'}`}>{status}</p>
      )}
    </motion.div>
  );
}
