'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { money } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/ui/empty-state';
import { CourseDialog, type CourseRecord } from '@/features/academics/course-dialog';

interface CourseRow extends CourseRecord {
  batchCount: number;
}

export default function AdminCoursesPage() {
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CourseRecord | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['courses', page],
    queryFn: async () => {
      const result = await apiFetch<{ data: CourseRow[]; meta: { total: number } }>(
        `/courses${qs({ page, pageSize: 20 })}`,
      );
      return result;
    },
  });

  const columns = React.useMemo<ColumnDef<CourseRow, unknown>[]>(
    () => [
      {
        id: 'title',
        header: 'Course',
        accessorKey: 'title',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.title}</p>
            <p className="font-mono text-xs text-muted-foreground">{row.original.code}</p>
          </div>
        ),
      },
      {
        id: 'duration',
        header: 'Duration',
        accessorFn: (row) => row.durationValue,
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.durationValue} {row.original.durationUnit.toLowerCase()}
          </span>
        ),
      },
      {
        id: 'fee',
        header: 'Default fee',
        accessorKey: 'defaultFeeMinor',
        cell: ({ row }) => <span className="text-sm">{money(row.original.defaultFeeMinor ?? 0)}</span>,
      },
      {
        id: 'batches',
        header: 'Batches',
        accessorKey: 'batchCount',
        cell: ({ row }) => <span className="text-sm">{row.original.batchCount}</span>,
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
          <Button
            size="sm"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              setEditing(row.original);
              setOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Courses"
        description="Programmes offered by the institute, their duration and default fees."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New course
          </Button>
        }
      />

      {error ? (
        <ErrorState message="Courses could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            emptyTitle="No courses yet"
            emptyDescription="Create the first course to start building batches."
          />
          <Pagination page={page} pageSize={20} total={data?.meta.total ?? 0} onPageChange={setPage} />
        </>
      )}

      <CourseDialog open={open} onOpenChange={setOpen} course={editing} />
    </div>
  );
}
