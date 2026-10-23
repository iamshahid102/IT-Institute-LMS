'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { dateLabel, money } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/ui/empty-state';
import { EnrollDialog } from './enroll-dialog';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface EnrollmentRow {
  id: string;
  status: string;
  joinedAt: string;
  agreedFeeMinor: number;
  currency: string;
  student: { id: string; studentNumber: string; fullName: string };
  batch: {
    id: string;
    code: string;
    name: string;
    status: string;
    course: { title: string; code: string };
    instructor: { fullName: string } | null;
  };
}

export function EnrollmentsPage({ mode }: { mode: 'admin' | 'front-desk' }) {
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('ALL');
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState(false);
  const debounced = useDebouncedValue(search, 300);

  React.useEffect(() => setPage(1), [debounced, status]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['enrollments', { page, debounced, status }],
    queryFn: async () => {
      const result = await apiFetch<{ data: EnrollmentRow[]; meta: { total: number } }>(
        `/enrollments${qs({ page, pageSize: 20, search: debounced, status: status === 'ALL' ? undefined : status })}`,
      );
      return result;
    },
  });

  const columns = React.useMemo<ColumnDef<EnrollmentRow, unknown>[]>(
    () => [
      {
        id: 'student',
        header: 'Student',
        accessorFn: (row) => row.student.fullName,
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.student.fullName}</p>
            <p className="font-mono text-xs text-muted-foreground">{row.original.student.studentNumber}</p>
          </div>
        ),
      },
      {
        id: 'course',
        header: 'Course & batch',
        accessorFn: (row) => row.batch.course.title,
        cell: ({ row }) => (
          <div>
            <p>{row.original.batch.course.title}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.batch.code} · {row.original.batch.name}
            </p>
          </div>
        ),
      },
      {
        id: 'joinedAt',
        header: 'Joined',
        accessorKey: 'joinedAt',
        cell: ({ row }) => <span className="text-sm">{dateLabel(row.original.joinedAt)}</span>,
      },
      {
        id: 'fee',
        header: 'Agreed fee',
        accessorKey: 'agreedFeeMinor',
        cell: ({ row }) => (
          <span className="text-sm font-medium">{money(row.original.agreedFeeMinor, row.original.currency)}</span>
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
        title="Enrollments"
        description="Students can hold multiple enrollments over time; each is linked to one batch."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New enrollment
          </Button>
        }
      />

      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-card sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search student, student number or batch code"
            className="pl-9"
            aria-label="Search enrollments"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-44" aria-label="Filter by enrollment status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState message="Enrollments could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            onRowClick={(row) => router.push(`${base}/enrollments/${row.id}`)}
            emptyTitle="No enrollments found"
            emptyDescription="Enroll a student into a batch to begin tracking attendance and fees."
          />
          <Pagination page={page} pageSize={20} total={data?.meta.total ?? 0} onPageChange={setPage} />
        </>
      )}

      <EnrollDialog
        open={open}
        onOpenChange={setOpen}
        onEnrolled={() => router.refresh()}
      />
    </div>
  );
}
