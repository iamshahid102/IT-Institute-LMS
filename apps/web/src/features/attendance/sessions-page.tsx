'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, ScanLine, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { dateTimeLabel } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBatches } from '@/features/shared/options';
import { useAuth } from '@/features/auth/auth-context';
import { SessionDialog } from './session-dialog';

interface SessionRow {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  topic: string | null;
  markedCount: number;
  batch: { id: string; code: string; name: string; course: { title: string } };
}

export function SessionsPage({ mode }: { mode: 'admin' | 'front-desk' }) {
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const searchParams = useSearchParams();
  const { can } = useAuth();
  const [status, setStatus] = React.useState('ALL');
  const [batchId, setBatchId] = React.useState(searchParams.get('batchId') ?? 'ALL');
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState(false);
  const batches = useBatches();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['attendance', 'sessions', page, status, batchId],
    queryFn: async () => {
      const result = await apiFetch<{ data: SessionRow[]; meta: { total: number } }>(
        `/attendance/sessions${qs({
          page,
          pageSize: 20,
          status: status === 'ALL' ? undefined : status,
          batchId: batchId === 'ALL' ? undefined : batchId,
        })}`,
      );
      return result;
    },
  });

  const columns = React.useMemo<ColumnDef<SessionRow, unknown>[]>(
    () => [
      {
        id: 'session',
        header: 'Session',
        accessorFn: (row) => row.startsAt,
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.topic ?? 'Class session'}</p>
            <p className="text-xs text-muted-foreground">{dateTimeLabel(row.original.startsAt)}</p>
          </div>
        ),
      },
      {
        id: 'batch',
        header: 'Batch',
        accessorFn: (row) => row.batch.code,
        cell: ({ row }) => (
          <div>
            <p className="text-sm">{row.original.batch.course.title}</p>
            <p className="font-mono text-xs text-muted-foreground">{row.original.batch.code}</p>
          </div>
        ),
      },
      {
        id: 'marked',
        header: 'Marked',
        accessorKey: 'markedCount',
        cell: ({ row }) => <span className="text-sm">{row.original.markedCount}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button size="sm" variant="ghost" asChild>
            <Link href={`${base}/attendance/sessions/${row.original.id}`}>
              {row.original.status === 'OPEN' ? 'Mark attendance' : 'View'}
            </Link>
          </Button>
        ),
      },
    ],
    [base],
  );

  const openSession = data?.data.find((session) => session.status === 'OPEN');

  return (
    <div className="space-y-4">
      <PageHeader
        title="Attendance sessions"
        description="Open a session to mark attendance, then finalize it. Cancelled sessions never count."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`${base}/attendance/scan${openSession ? `?sessionId=${openSession.id}` : ''}`}>
                <ScanLine className="h-4 w-4" /> Scan QR
              </Link>
            </Button>
            {can('attendance.session.manage') ? (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> New session
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-card sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by batch"
            className="pl-9"
            value={batchId === 'ALL' ? '' : batches.data?.find((batch) => batch.id === batchId)?.code ?? ''}
            onChange={(event) => {
              const match = batches.data?.find((batch) =>
                batch.code.toLowerCase().includes(event.target.value.toLowerCase()),
              );
              setBatchId(event.target.value ? match?.id ?? 'ALL' : 'ALL');
            }}
            aria-label="Filter by batch code"
          />
        </div>
        <div className="flex gap-2">
          <Select value={batchId} onValueChange={setBatchId}>
            <SelectTrigger className="w-52" aria-label="Batch">
              <SelectValue placeholder="All batches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All batches</SelectItem>
              {(batches.data ?? []).map((batch) => (
                <SelectItem key={batch.id} value={batch.id}>
                  {batch.code} · {batch.course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" aria-label="Session status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="FINALIZED">Finalized</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <ErrorState message="Sessions could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            emptyTitle="No sessions found"
            emptyDescription="Create a session for a batch to begin marking attendance."
          />
          <Pagination page={page} pageSize={20} total={data?.meta.total ?? 0} onPageChange={setPage} />
        </>
      )}

      <SessionDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
