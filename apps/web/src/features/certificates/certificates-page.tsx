'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Award, CheckCircle2, Download, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, downloadFile, formatApiError } from '@/lib/api';
import { dateLabel } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState, EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { useEnrollmentSearch } from '@/features/shared/options';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface CertificateRow {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  status: string;
  issuedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  enrollment: {
    student: { id: string; studentNumber: string; fullName: string };
    batch: { code: string; name: string; course: { title: string } };
  };
  issuedBy: { fullName: string } | null;
}

interface Eligibility {
  enrollmentId: string;
  student: { studentNumber: string; fullName: string };
  courseTitle: string;
  batchCode: string;
  checks: Array<{ key: string; label: string; passed: boolean; detail: string }>;
  eligible: boolean;
  existingCertificate: { id: string; certificateNumber: string } | null;
}

export function CertificatesPage({ mode }: { mode: 'admin' | 'front-desk' }) {
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = React.useState('ALL');
  const [page, setPage] = React.useState(1);
  const [issueOpen, setIssueOpen] = React.useState(false);
  const [revoking, setRevoking] = React.useState<CertificateRow | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['certificates', page, status, debouncedSearch],
    queryFn: async () =>
      apiFetch<{ data: CertificateRow[]; meta: { total: number } }>(
        `/certificates${qs({
          page,
          pageSize: 20,
          status: status === 'ALL' ? undefined : status,
          search: debouncedSearch || undefined,
        })}`,
      ),
  });

  const columns = React.useMemo<ColumnDef<CertificateRow, unknown>[]>(
    () => [
      {
        id: 'certificate',
        header: 'Certificate',
        accessorKey: 'certificateNumber',
        cell: ({ row }) => (
          <div>
            <p className="font-mono text-sm font-medium">{row.original.certificateNumber}</p>
            <p className="text-xs text-muted-foreground">Issued {dateLabel(row.original.issuedAt)}</p>
          </div>
        ),
      },
      {
        id: 'student',
        header: 'Student',
        accessorFn: (row) => row.enrollment.student.fullName,
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium">{row.original.enrollment.student.fullName}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {row.original.enrollment.student.studentNumber} · {row.original.enrollment.batch.code}
            </p>
          </div>
        ),
      },
      {
        id: 'course',
        header: 'Course',
        accessorFn: (row) => row.enrollment.batch.course.title,
        cell: ({ row }) => <span className="text-sm">{row.original.enrollment.batch.course.title}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => (
          <div>
            <StatusBadge status={row.original.status} />
            {row.original.revokedReason ? (
              <p className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground">{row.original.revokedReason}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/verify-certificate/${row.original.verificationCode}`} target="_blank">
                Verify
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void downloadFile(
                  `/certificates/${row.original.id}/download`,
                  `${row.original.certificateNumber}.pdf`,
                ).catch((downloadError) => toast.error(formatApiError(downloadError)))
              }
            >
              <Download className="h-3.5 w-3.5" />
              <span className="sr-only">Download</span>
            </Button>
            {can('certificate.revoke') && row.original.status === 'ISSUED' ? (
              <Button size="sm" variant="outline" onClick={() => setRevoking(row.original)}>
                Revoke
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [can],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Certificates"
        description="Issue, download and revoke certificates. Every action is audited."
        backHref={base}
        backLabel="Dashboard"
        actions={
          can('certificate.issue') ? (
            <Button onClick={() => setIssueOpen(true)}>
              <Award className="h-4 w-4" /> Issue certificate
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-card sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search certificate, student or student number"
            className="pl-9"
            aria-label="Search certificates"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Certificate status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ISSUED">Issued</SelectItem>
            <SelectItem value="REVOKED">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState message="Certificates could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            emptyTitle="No certificates issued"
            emptyDescription="Issue a certificate once a student completes their enrollment."
          />
          <Pagination page={page} pageSize={20} total={data?.meta.total ?? 0} onPageChange={setPage} />
        </>
      )}

      <IssueDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        onIssued={() => {
          void queryClient.invalidateQueries({ queryKey: ['certificates'] });
        }}
      />

      <RevokeDialog
        certificate={revoking}
        onOpenChange={(open) => !open && setRevoking(null)}
        onRevoked={() => void refetch()}
      />
    </div>
  );
}

function IssueDialog({
  open,
  onOpenChange,
  onIssued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIssued: () => void;
}) {
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const enrollments = useEnrollmentSearch(debouncedSearch);
  const [enrollmentId, setEnrollmentId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const eligibility = useQuery({
    queryKey: ['certificate-eligibility', enrollmentId],
    queryFn: async () =>
      (await apiFetch<{ data: Eligibility }>(`/certificates/eligibility/${enrollmentId}`)).data,
    enabled: Boolean(enrollmentId),
  });

  React.useEffect(() => {
    if (!open) {
      setSearch('');
      setEnrollmentId(null);
      setError(null);
    }
  }, [open]);

  const issue = async () => {
    if (!enrollmentId) return;
    setPending(true);
    setError(null);
    try {
      const result = await apiFetch<{ data: { certificateNumber: string } }>('/certificates/issue', {
        method: 'POST',
        body: JSON.stringify({ enrollmentId }),
      });
      toast.success(`Certificate ${result.data.certificateNumber} issued.`);
      onIssued();
      onOpenChange(false);
    } catch (issueError) {
      setError(formatApiError(issueError));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Issue certificate</DialogTitle>
          <DialogDescription>
            Eligibility is evaluated by the server against completion, attendance, fees and assessments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? <FormErrorSummary message={error} /> : null}

          {enrollmentId && eligibility.data ? (
            <div className="space-y-3">
              <div className="rounded-lg border p-3">
                <p className="font-medium">{eligibility.data.student.fullName}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {eligibility.data.student.studentNumber} · {eligibility.data.batchCode}
                </p>
                <p className="mt-1 text-sm">{eligibility.data.courseTitle}</p>
              </div>
              <ul className="space-y-2">
                {eligibility.data.checks.map((check) => (
                  <li key={check.key} className="flex items-start gap-2 text-sm">
                    {check.passed ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <span>
                      <span className="font-medium">{check.label}</span>
                      <span className="block text-xs text-muted-foreground">{check.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {eligibility.data.existingCertificate ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  A certificate already exists: {eligibility.data.existingCertificate.certificateNumber}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEnrollmentId(null)} disabled={pending}>
                  Change enrollment
                </Button>
                <Button
                  onClick={() => void issue()}
                  disabled={
                    pending ||
                    !eligibility.data.eligible ||
                    Boolean(eligibility.data.existingCertificate)
                  }
                >
                  {pending ? 'Issuing…' : 'Issue certificate'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <FormField label="Enrollment" required>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search student or batch"
                    className="pl-9"
                  />
                </div>
              </FormField>
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                {enrollmentId && eligibility.isLoading ? (
                  <Skeleton className="m-2 h-10" />
                ) : (enrollments.data?.length ?? 0) === 0 ? (
                  <EmptyState title="No enrollments found" description="Search by student name, number or batch." />
                ) : (
                  enrollments.data?.map((enrollment) => (
                    <button
                      key={enrollment.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-muted/50"
                      onClick={() => setEnrollmentId(enrollment.id)}
                    >
                      <span>
                        <span className="font-medium">{enrollment.student.fullName}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {enrollment.student.studentNumber} · {enrollment.batch.code}
                        </span>
                      </span>
                      <StatusBadge status={enrollment.status} />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RevokeDialog({
  certificate,
  onOpenChange,
  onRevoked,
}: {
  certificate: CertificateRow | null;
  onOpenChange: (open: boolean) => void;
  onRevoked: () => void;
}) {
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setReason('');
    setError(null);
  }, [certificate]);

  const submit = async () => {
    if (!certificate) return;
    if (reason.trim().length < 5) {
      setError('Provide a revocation reason of at least 5 characters.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/certificates/${certificate.id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      toast.success('Certificate revoked. Public verification will show the revoked status.');
      onRevoked();
      onOpenChange(false);
    } catch (revokeError) {
      setError(formatApiError(revokeError));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={Boolean(certificate)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke certificate</DialogTitle>
          <DialogDescription>
            {certificate ? `${certificate.certificateNumber} · ${certificate.enrollment.student.fullName}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormErrorSummary message={error} />
          <FormField label="Reason" required hint="Shown on the public verification page.">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Issued in error — assessment result was corrected."
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void submit()} disabled={pending}>
              {pending ? 'Revoking…' : 'Revoke certificate'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
