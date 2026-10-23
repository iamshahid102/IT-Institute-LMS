'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, formatApiError } from '@/lib/api';
import { dateTimeLabel } from '@/lib/format';
import { useAuth } from '@/features/auth/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type AttendanceStatusValue = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

const STATUS_OPTIONS: AttendanceStatusValue[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

interface RosterEntry {
  enrollmentId: string;
  enrollmentStatus: string;
  student: { id: string; studentNumber: string; fullName: string; phone: string; status: string };
  attendance: {
    id: string;
    status: string;
    method: string;
    markedAt: string;
    markedBy: { fullName: string } | null;
    remarks: string | null;
    correctionReason: string | null;
    correctedAt: string | null;
    correctedBy: { fullName: string } | null;
  } | null;
}

interface SessionDetail {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  topic: string | null;
  markedCount: number;
  batch: { id: string; code: string; name: string; course: { title: string } };
  roster: RosterEntry[];
  counts: { present: number; late: number; absent: number; excused: number; unmarked: number };
}

export function SessionRoster({ sessionId, mode }: { sessionId: string; mode: 'admin' | 'front-desk' }) {
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [correcting, setCorrecting] = React.useState<RosterEntry | null>(null);

  const { data: session, isLoading, error, refetch } = useQuery({
    queryKey: ['attendance', 'session', sessionId],
    queryFn: async () => (await apiFetch<{ data: SessionDetail }>(`/attendance/sessions/${sessionId}`)).data,
    refetchInterval: (query) => (query.state.data?.status === 'OPEN' ? 15_000 : false),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['attendance'] });
  };

  const lifecycle = useMutation({
    mutationFn: async ({ action, label }: { action: 'open' | 'finalize' | 'cancel'; label: string }) => {
      await apiFetch(`/attendance/sessions/${sessionId}/${action}`, { method: 'POST' });
      return label;
    },
    onSuccess: (label) => {
      toast.success(label);
      invalidate();
    },
    onError: (mutationError) => toast.error(formatApiError(mutationError)),
  });

  const mark = useMutation({
    mutationFn: async (input: { studentNumber: string; status: AttendanceStatusValue }) => {
      await apiFetch('/attendance/manual', {
        method: 'POST',
        body: JSON.stringify({ sessionId, studentNumber: input.studentNumber, status: input.status }),
      });
      return input;
    },
    onSuccess: (input) => {
      toast.success(`Marked ${input.status.toLowerCase()} for ${input.studentNumber}.`);
      invalidate();
    },
    onError: (mutationError) => toast.error(formatApiError(mutationError)),
  });

  if (isLoading) return <LoadingSkeleton rows={6} />;
  if (error || !session) return <ErrorState message="This session could not be loaded." onRetry={() => void refetch()} />;

  const isOpen = session.status === 'OPEN';
  const isFinalized = session.status === 'FINALIZED';
  const canMark = isOpen && can('attendance.mark');
  const canCorrect = isFinalized && can('attendance.correct');

  return (
    <div className="space-y-4">
      <PageHeader
        title={session.topic ?? 'Class session'}
        description={`${session.batch.course.title} · ${session.batch.code} · ${dateTimeLabel(session.startsAt)}`}
        backHref={`${base}/attendance/sessions`}
        backLabel="All sessions"
        actions={
          <>
            <StatusBadge status={session.status} />
            <Button variant="outline" asChild>
              <Link href={`${base}/attendance`}>
                <CalendarClock className="h-4 w-4" /> All sessions
              </Link>
            </Button>
            {canMark ? (
              <Button asChild>
                <Link href={`${base}/attendance/scan?sessionId=${session.id}`}>
                  <ScanLine className="h-4 w-4" /> Scan QR
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Present', value: session.counts.present, tone: 'text-emerald-600' },
          { label: 'Late', value: session.counts.late, tone: 'text-amber-600' },
          { label: 'Absent', value: session.counts.absent, tone: 'text-destructive' },
          { label: 'Excused', value: session.counts.excused, tone: 'text-sky-600' },
          { label: 'Unmarked', value: session.counts.unmarked, tone: 'text-muted-foreground' },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</p>
              <p className={cn('mt-1 text-2xl font-semibold tabular-nums', metric.tone)}>{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Session controls</CardTitle>
          <div className="flex flex-wrap gap-2">
            {session.status === 'SCHEDULED' && can('attendance.session.manage') ? (
              <Button size="sm" onClick={() => lifecycle.mutate({ action: 'open', label: 'Session opened for marking.' })}>
                Open session
              </Button>
            ) : null}
            {isOpen && can('attendance.finalize') ? (
              <ConfirmDialog
                trigger={<Button size="sm">Finalize attendance</Button>}
                title="Finalize this session?"
                description="Any student still unmarked will be recorded absent. After finalizing, changes are only possible through an audited correction."
                confirmLabel="Finalize"
                pending={lifecycle.isPending}
                onConfirm={async () => {
                  await lifecycle.mutateAsync({ action: 'finalize', label: 'Session finalized.' });
                }}
              />
            ) : null}
            {session.status !== 'FINALIZED' && session.status !== 'CANCELLED' && can('attendance.session.manage') ? (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="outline">
                    Cancel session
                  </Button>
                }
                title="Cancel this class session?"
                description="Cancelled sessions are excluded from attendance percentages. Marked records become irrelevant."
                confirmLabel="Cancel session"
                destructive
                pending={lifecycle.isPending}
                onConfirm={async () => {
                  await lifecycle.mutateAsync({ action: 'cancel', label: 'Session cancelled.' });
                }}
              />
            ) : null}
          </div>
        </CardHeader>
        {isOpen ? (
          <CardContent className="text-sm text-muted-foreground">
            Mark each student below or use the QR scanner. Finalize when the class is complete.
          </CardContent>
        ) : session.status === 'SCHEDULED' ? (
          <CardContent className="text-sm text-muted-foreground">
            Attendance can only be recorded while a session is open.
          </CardContent>
        ) : session.status === 'CANCELLED' ? (
          <CardContent className="text-sm text-muted-foreground">
            This session was cancelled and is excluded from attendance calculations.
          </CardContent>
        ) : (
          <CardContent className="text-sm text-muted-foreground">
            Finalized. Authorized staff can correct a record with a documented reason.
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roster · {session.roster.length} enrolled</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {session.roster.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No enrolled students" description="Add enrollments to this batch to mark attendance." />
            </div>
          ) : (
            <div className="divide-y">
              {session.roster.map((entry) => (
                <div key={entry.enrollmentId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.student.fullName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{entry.student.studentNumber}</p>
                    {entry.attendance ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.attendance.method === 'QR' ? 'QR' : 'Manual'} by{' '}
                        {entry.attendance.markedBy?.fullName ?? 'system'} · {dateTimeLabel(entry.attendance.markedAt)}
                        {entry.attendance.correctionReason ? ` · corrected: ${entry.attendance.correctionReason}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={entry.attendance?.status ?? 'UNMARKED'} />
                    {canMark && !entry.attendance ? (
                      <div className="flex gap-1">
                        {STATUS_OPTIONS.map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant={status === 'PRESENT' ? 'default' : 'outline'}
                            disabled={mark.isPending}
                            onClick={() =>
                              mark.mutate({ studentNumber: entry.student.studentNumber, status })
                            }
                          >
                            {status.charAt(0)}
                            <span className="sr-only">Mark {status.toLowerCase()}</span>
                          </Button>
                        ))}
                      </div>
                    ) : null}
                    {canCorrect && entry.attendance ? (
                      <Button size="sm" variant="outline" onClick={() => setCorrecting(entry)}>
                        Correct
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CorrectionDialog
        entry={correcting}
        onOpenChange={(open) => !open && setCorrecting(null)}
        onCorrected={invalidate}
      />
    </div>
  );
}

function CorrectionDialog({
  entry,
  onOpenChange,
  onCorrected,
}: {
  entry: RosterEntry | null;
  onOpenChange: (open: boolean) => void;
  onCorrected: () => void;
}) {
  const [status, setStatus] = React.useState<AttendanceStatusValue>('PRESENT');
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!entry?.attendance) return;
    setStatus(entry.attendance.status as AttendanceStatusValue);
    setReason('');
    setError(null);
  }, [entry]);

  const submit = async () => {
    if (!entry?.attendance) return;
    if (reason.trim().length < 5) {
      setError('A correction reason of at least 5 characters is required.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/attendance/records/${entry.attendance.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason: reason.trim() }),
      });
      toast.success('Attendance corrected and audit logged.');
      onCorrected();
      onOpenChange(false);
    } catch (mutationError) {
      setError(formatApiError(mutationError));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct attendance</DialogTitle>
          <DialogDescription>
            {entry?.student.fullName} · {entry?.student.studentNumber}. Corrections are recorded in the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
          ) : null}
          <FormField label="New status" required>
            <Select value={status} onValueChange={(value) => setStatus(value as AttendanceStatusValue)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option.charAt(0) + option.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Reason" required hint="Stored with the correction and shown to auditors.">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Student arrived late and was present for the lab."
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={pending}>
              {pending ? 'Saving…' : 'Save correction'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
