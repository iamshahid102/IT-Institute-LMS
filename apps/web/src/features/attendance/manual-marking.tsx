'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, formatApiError } from '@/lib/api';
import { dateTimeLabel } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';

type AttendanceStatusValue = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

interface OpenSession {
  id: string;
  startsAt: string;
  topic: string | null;
  batch: { code: string; name: string; course: { title: string } };
}

interface MarkResult {
  student: { id: string; fullName: string; studentNumber: string };
  batch: { code: string; name: string };
  record: { status: string };
}

export function ManualMarking({ mode }: { mode: 'admin' | 'front-desk' }) {
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const [sessionId, setSessionId] = React.useState('');
  const [studentNumber, setStudentNumber] = React.useState('');
  const [status, setStatus] = React.useState<AttendanceStatusValue>('PRESENT');
  const [remarks, setRemarks] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<MarkResult[]>([]);

  const sessions = useQuery({
    queryKey: ['attendance', 'sessions', 'open'],
    queryFn: async () =>
      (
        await apiFetch<{ data: OpenSession[] }>(
          `/attendance/sessions${qs({ status: 'OPEN', pageSize: 50 })}`,
        )
      ).data,
    refetchInterval: 30_000,
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!sessionId) {
      setError('Select an open session first.');
      return;
    }
    if (!studentNumber.trim()) {
      setError('Enter the student number.');
      return;
    }
    setPending(true);
    try {
      const result = await apiFetch<{ data: MarkResult }>('/attendance/manual', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          studentNumber: studentNumber.trim().toUpperCase(),
          status,
          remarks: remarks.trim() || undefined,
        }),
      });
      setResults((current) => [result.data, ...current].slice(0, 6));
      toast.success(`${result.data.student.fullName} marked ${status.toLowerCase()}.`);
      setStudentNumber('');
      setRemarks('');
    } catch (submissionError) {
      setError(formatApiError(submissionError));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Manual attendance"
        description="Enter a student number to record attendance when QR scanning is not available."
        backHref={`${base}/attendance`}
        backLabel="Attendance"
        actions={
          <Button variant="outline" asChild>
            <Link href={`${base}/attendance/scan`}>Scan QR instead</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Record attendance</CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.data && sessions.data.length === 0 ? (
              <EmptyState
                title="No open session"
                description="Open a scheduled session before marking attendance."
                action={
                  <Button asChild size="sm">
                    <Link href={`${base}/attendance`}>Go to sessions</Link>
                  </Button>
                }
              />
            ) : (
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="manual-session">Session</Label>
                  <Select value={sessionId} onValueChange={setSessionId}>
                    <SelectTrigger id="manual-session">
                      <SelectValue placeholder="Select an open session" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sessions.data ?? []).map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          {session.batch.code} · {dateTimeLabel(session.startsAt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manual-number">Student number</Label>
                  <Input
                    id="manual-number"
                    value={studentNumber}
                    onChange={(event) => setStudentNumber(event.target.value)}
                    placeholder="STU-2026-0001"
                    autoCapitalize="characters"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manual-status">Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as AttendanceStatusValue)}>
                    <SelectTrigger id="manual-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRESENT">Present</SelectItem>
                      <SelectItem value="LATE">Late</SelectItem>
                      <SelectItem value="ABSENT">Absent</SelectItem>
                      <SelectItem value="EXCUSED">Excused</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manual-remarks">Remarks (optional)</Label>
                  <Textarea
                    id="manual-remarks"
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    placeholder="Arrived after the practical started."
                  />
                </div>
                {error ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" disabled={pending}>
                  <UserCheck className="h-4 w-4" />
                  {pending ? 'Marking…' : 'Mark attendance'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Marked in this session</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students marked yet from this screen.</p>
            ) : (
              <ul className="space-y-3">
                {results.map((result) => (
                  <li key={`${result.student.id}-${result.record.status}-${results.indexOf(result)}`} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{result.student.fullName}</p>
                        <p className="font-mono text-xs text-muted-foreground">{result.student.studentNumber}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{result.batch.code}</p>
                      </div>
                      <StatusBadge status={result.record.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" /> Duplicate entries are rejected by the server.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
