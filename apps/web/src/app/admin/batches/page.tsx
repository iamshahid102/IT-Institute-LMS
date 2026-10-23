'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { dateLabel } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BatchDialog, type BatchRecord } from '@/features/academics/batch-dialog';

export default function AdminBatchesPage() {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState('ALL');
  const [open, setOpen] = React.useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['batches', page, status],
    queryFn: async () => {
      const result = await apiFetch<{ data: BatchRecord[]; meta: { total: number } }>(
        `/batches${qs({ page, pageSize: 20, status: status === 'ALL' ? undefined : status })}`,
      );
      return result;
    },
  });

  const columns = React.useMemo<ColumnDef<BatchRecord, unknown>[]>(
    () => [
      {
        id: 'batch',
        header: 'Batch',
        accessorFn: (row) => row.code,
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{row.original.code}</p>
          </div>
        ),
      },
      {
        id: 'course',
        header: 'Course',
        accessorFn: (row) => row.course.title,
        cell: ({ row }) => <span className="text-sm">{row.original.course.title}</span>,
      },
      {
        id: 'instructor',
        header: 'Instructor',
        accessorFn: (row) => row.instructor?.fullName ?? '',
        cell: ({ row }) => <span className="text-sm">{row.original.instructor?.fullName ?? 'Unassigned'}</span>,
      },
      {
        id: 'dates',
        header: 'Dates',
        accessorFn: (row) => row.startDate,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {dateLabel(row.original.startDate)} – {dateLabel(row.original.endDate)}
          </span>
        ),
      },
      {
        id: 'capacity',
        header: 'Enrolled',
        accessorFn: (row) => row.capacity,
        cell: ({ row }) => (
          <span className="text-sm">
            {(row.original as BatchRecord & { enrolledCount?: number }).enrolledCount ?? 0}/{row.original.capacity}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Batches"
        description="Scheduled cohorts, capacity and instructor assignment."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New batch
          </Button>
        }
      />

      <div className="flex justify-end">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44" aria-label="Filter batches by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="PLANNED">Planned</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState message="Batches could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            onRowClick={(batch) => router.push(`/admin/batches/${batch.id}`)}
            emptyTitle="No batches yet"
            emptyDescription="Create a batch to enroll students and schedule classes."
          />
          <Pagination page={page} pageSize={20} total={data?.meta.total ?? 0} onPageChange={setPage} />
        </>
      )}

      <BatchDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
