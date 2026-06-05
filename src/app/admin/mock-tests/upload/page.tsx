'use client';
import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { databases } from '@/lib/appwrite/client';
import { ID, Query } from 'appwrite';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

const COURSE_OPTIONS = [
  { value: 'JEPBN', label: 'JEPBN 2026', duration: 5400 },
  { value: 'JENPAS_UG_P1', label: 'JENPAS (UG) — Paper I', duration: 7200 },
  { value: 'JENPAS_UG_P2', label: 'JENPAS (UG) — Paper II (BHA)', duration: 7200 },
  { value: 'ANM_GNM', label: 'ANM & GNM', duration: 7200 },
  { value: 'JEMSCN', label: 'JEMScN 2026', duration: 5400 },
  { value: 'JEMAS', label: 'JEMAS (PG)', duration: 5400 },
];

interface UploadRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
}

export default function AdminMockTestUploadPage() {
  const [course, setCourse] = useState('');
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; mockTestId?: string; message?: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current);
    return fields;
  }

  const parseCSV = useCallback((text: string) => {
    const clean = text.replace(/^\ufeff/, '');
    const lines = clean.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return;
    const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
    const required = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct'];
    const parsed: UploadRow[] = [];
    let errorCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]).map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
      const errors: string[] = [];
      for (const req of required) {
        if (!row[req]) errors.push(`${req} is required`);
      }
      if (row.correct && !['a', 'b', 'c', 'd'].includes(row.correct.toLowerCase())) {
        errors.push('correct must be a/b/c/d');
      }
      const valid = errors.length === 0;
      if (!valid) errorCount++;
      parsed.push({ rowIndex: i, data: row, errors, valid });
    }
    if (parsed.length > 0 && errorCount / parsed.length > 0.1) {
      setRows(parsed.map((r) => ({ ...r, errors: [...r.errors, '>10% rows malformed'], valid: false })));
    } else {
      setRows(parsed);
    }
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        parseCSV(text);
      };
      reader.readAsText(file);
    },
    [parseCSV]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleUpload = async () => {
    if (!course) { setResult({ success: 0, failed: 1 }); return; }
    setUploading(true);
    setResult(null);
    try {
      const validRows = rows.filter((r) => r.valid);
      if (validRows.length !== 100) {
        setResult({ success: 0, failed: 1, message: `Need exactly 100 valid questions, got ${validRows.length}` });
        return;
      }

      const { documents: existing } = await databases.listDocuments(DB_ID, 'mock_tests', [
        Query.equal('exam_code', course),
        Query.orderDesc('serial_number'),
        Query.limit(1),
      ]);
      const highest = (existing as any[])?.[0]?.serial_number ?? 0;
      const serialNumber = Number(highest) + 1;
      const title = `${course}_${serialNumber}`;

      const examConfig = COURSE_OPTIONS.find((c) => c.value === course);
      const duration = examConfig?.duration ?? 5400;

      const mockTest = await databases.createDocument(DB_ID, 'mock_tests', ID.unique(), {
        exam_code: course,
        title,
        serial_number: serialNumber,
        duration_seconds: duration,
        status: 'published',
        published_at: new Date().toISOString(),
      });

      const mockTestId = mockTest.$id;
      let success = 0;
      let failed = 0;

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        try {
          await databases.createDocument(DB_ID, 'mock_test_questions', ID.unique(), {
            mock_test_id: mockTestId,
            question: row.data.question,
            option_a: row.data.option_a,
            option_b: row.data.option_b,
            option_c: row.data.option_c,
            option_d: row.data.option_d,
            correct: row.data.correct.toUpperCase(),
            explanation: row.data.explanation ?? '',
            order_index: i,
          });
          success++;
        } catch { failed++; }
      }

      setResult({ success, failed, mockTestId });
      if (failed === 0) setRows([]);
    } catch (err) {
      console.error('Upload failed:', err);
      setResult({ success: 0, failed: 1, message: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/mock-tests" className="text-sm text-primary hover:underline flex items-center gap-1 mb-2">
            <ArrowLeft size={14} /> Back to Mock Tests
          </Link>
          <h1 className="text-3xl font-bold text-ink">Upload Mock Test Questions</h1>
          <p className="text-sm text-ink-muted mt-1">
            Upload exactly 100 questions. System auto-assigns mock test number (exam_name_N).
          </p>
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <label className="text-sm font-bold text-ink mb-2 block">Exam</label>
          <select
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-ink text-sm"
          >
            <option value="">— Select an exam —</option>
            {COURSE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({Math.floor(opt.duration / 60)} min)
              </option>
            ))}
          </select>
        </div>

        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <FileSpreadsheet size={48} className="mx-auto mb-4 text-ink-muted" />
          <h3 className="text-lg font-bold text-ink mb-2">Drop CSV file here</h3>
          <p className="text-sm text-ink-muted mb-1">100 questions with answers and explanations</p>
          <p className="text-xs text-ink-muted mb-4">
            Columns: <code className="bg-surface2 px-1 rounded">question,option_a,option_b,option_c,option_d,correct,explanation</code>
          </p>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            className="hidden"
            id="csv-upload"
          />
          <Button variant="secondary" onClick={() => document.getElementById('csv-upload')?.click()}>
            <Upload size={18} /> Browse Files
          </Button>
        </div>

        {rows.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-bold text-ink mb-4">
              Preview ({rows.filter((r) => r.valid).length} valid / {rows.length} total
              {rows.length !== 100 ? ' — Need exactly 100 questions' : ''})
            </h3>
            <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
              {rows.map((row) => (
                <div key={row.rowIndex} className={`p-3 rounded-xl text-sm border ${row.valid ? 'border-border' : 'border-danger/30 bg-danger/5'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-ink">Row {row.rowIndex}</span>
                    {row.valid ? <CheckCircle2 size={16} className="text-success" /> : <AlertCircle size={16} className="text-danger" />}
                  </div>
                  <p className="text-ink-muted truncate">{row.data.question}</p>
                  {row.errors.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {row.errors.map((err, i) => (
                        <p key={i} className="text-[10px] text-danger">{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button
              onClick={handleUpload}
              className="w-full"
              disabled={rows.filter((r) => r.valid).length !== 100 || uploading || !course}
            >
              <Upload size={18} />
              {uploading ? 'Uploading...' : `Upload ${rows.filter((r) => r.valid).length} Questions & Create Mock Test`}
            </Button>
          </Card>
        )}

        {result && !course && (
          <Card className="p-4 border-danger/30">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-danger" />
              <span className="text-sm text-ink">Please select an exam before uploading.</span>
            </div>
          </Card>
        )}

        {result && result.failed > 0 && result.mockTestId && (
          <Card className="p-4 border-warning/30">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-warning" />
              <span className="text-sm text-ink">{result.success} uploaded, {result.failed} failed</span>
            </div>
          </Card>
        )}

        {result && result.failed > 0 && !result.mockTestId && (
          <Card className="p-4 border-danger/30">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-danger" />
              <span className="text-sm text-ink">{result.message || 'Upload failed. Check your CSV and try again.'}</span>
            </div>
          </Card>
        )}

        {result && result.failed === 0 && result.mockTestId && (
          <Card className="p-4 border-success/30">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-success" />
              <span className="text-sm text-ink">
                Mock test created successfully! {result.success} questions uploaded.
              </span>
            </div>
          </Card>
        )}
      </Card>
    </motion.div>
  );
}
