'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { databases } from '@/lib/appwrite/client';
import { Query, ID } from 'appwrite';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Plus, Trash2, Merge } from 'lucide-react';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

export default function AdminTopicsPage() {
  const [topics, setTopics] = useState<Record<string, unknown>[]>([]);
  const [subjects, setSubjects] = useState<Record<string, unknown>[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [status, setStatus] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      const { documents } = await databases.listDocuments(
        DB_ID,
        'subjects',
        [Query.limit(100)]
      );
      if (documents) setSubjects(documents as Record<string, unknown>[]);
    })();
  }, []);

  useEffect(() => {
    if (!selectedSubject) { setTopics([]); return; }
    (async () => {
      const { documents } = await databases.listDocuments(
        DB_ID,
        'topics',
        [
          Query.equal('subject_id', selectedSubject),
          Query.orderAsc('name'),
          Query.limit(200),
        ]
      );
      if (documents) setTopics(documents as Record<string, unknown>[]);
    })();
  }, [selectedSubject, refreshKey]);

  const handleAddTopic = async () => {
    if (!newTopicName.trim() || !selectedSubject) return;
    setStatus('');
    const { error } = await databases.createDocument(
      DB_ID,
      'topics',
      ID.unique(),
      {
        subject_id: selectedSubject,
        name: newTopicName.trim(),
      }
    ).catch(e => ({ error: e }));

    setStatus(`Topic "${newTopicName}" created`);
    setNewTopicName('');
    setRefreshKey(k => k + 1);
  };

  const handleDeleteTopic = async (id: string) => {
    await databases.deleteDocument(DB_ID, 'topics', id);
    setRefreshKey(k => k + 1);
  };

  const handleMergeTopics = async () => {
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) return;
    setStatus('');
    const sourceTopic = topics.find(t => t.$id === mergeSourceId);
    const targetTopic = topics.find(t => t.$id === mergeTargetId);
    const sourceName = (sourceTopic?.name ?? '') as string;
    const targetName = (targetTopic?.name ?? '') as string;
    if (!sourceName || !targetName) return;
    const { documents: questions } = await databases.listDocuments(
      DB_ID,
      'questions',
      [Query.equal('topic', sourceName), Query.limit(5000)]
    );
    for (const q of questions as any[]) {
      await databases.updateDocument(DB_ID, 'questions', q.$id, { topic: targetName });
    }
    await databases.deleteDocument(DB_ID, 'topics', mergeSourceId);
    setStatus('Topics merged successfully');
    setMergeSourceId('');
    setMergeTargetId('');
    setRefreshKey(k => k + 1);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold text-ink">Topic Management</h1>

      <Card className="p-6 space-y-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-ink">Subject</label>
            <Select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
              <option value="">Select a subject</option>
              {subjects.map((s) => (
                <option key={s.$id as string} value={s.$id as string}>{s.name as string}</option>
              ))}
            </Select>
          </div>
        </div>

        {selectedSubject && (
          <>
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium text-ink">New Topic Name</label>
                <Input
                  placeholder="e.g. Bones of Upper Limb"
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                />
              </div>
              <Button onClick={handleAddTopic} size="sm">
                <Plus size={16} />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {topics.length === 0 ? (
                <p className="text-sm text-ink-muted italic">No topics yet for this subject.</p>
              ) : (
                topics.map((t) => (
                  <div key={t.$id as string} className="flex items-center justify-between p-3 bg-surface2 rounded-lg">
                    <span className="text-sm font-medium text-ink">{t.name as string}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTopic(t.$id as string)}
                      className="text-danger"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {topics.length >= 2 && (
              <>
                <hr className="border-border" />
                <h3 className="font-semibold text-sm text-ink">Merge Topics</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs text-ink-muted">Merge from</label>
                    <Select value={mergeSourceId} onChange={(e) => setMergeSourceId(e.target.value)}>
                      <option value="">Select source</option>
                      {topics.map((t) => (
                        <option key={t.$id as string} value={t.$id as string}>{t.name as string}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-ink-muted">Merge into</label>
                    <Select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)}>
                      <option value="">Select target</option>
                      {topics.filter(t => t.$id !== mergeSourceId).map((t) => (
                        <option key={t.$id as string} value={t.$id as string}>{t.name as string}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <Button onClick={handleMergeTopics} variant="outline" size="sm">
                  <Merge size={14} />
                  Merge Topics
                </Button>
              </>
            )}
          </>
        )}

        {status && (
          <p className={`text-sm ${status.startsWith('Error') ? 'text-danger' : 'text-success'}`}>{status}</p>
        )}
      </Card>
    </motion.div>
  );
}
