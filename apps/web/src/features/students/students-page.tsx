'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Search, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { dateLabel } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/ui/empty-state';
import { useCourses } from '@/features/shared/options';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface StudentRow {
  id: string;
  studentNumber: string;
  fullName: string;
  guardianName: string | null;
  phone: string;
  email: string | null;
  admissionDate: string;
  status: string;
  hasPortalAccount: boolean;
}

export function StudentsPage({ mode }: { mode: 'admin' | 'front-desk' }) {
  const router = useRouter();
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('ALL');
  const [courseId, setCourseId] = React.useState('ALL');
  const [page, setPage] = React.useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);
  const courses = useCourses({ includeAll: true });

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, courseId]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['students', { page, debouncedSearch, status, courseId }],
    queryFn: async () => {
      const result = await apiFetch<{ data: StudentRow[]; meta: { total: number } }>(
        `/students${qs({
          page,
          pageSize: 20,
          search: debouncedSearch,
          status: status === 'ALL' ? undefined : status,
          courseId: courseId === 'ALL' ? undefined : courseId,
        })}`,
      );
      return result;
    },
  });

  const columns = React.useMemo<ColumnDef<StudentRow, unknown>[]>(
    () => [
      {
        id: 'studentNumber',
        header: 'Student no.',
        accessorKey: 'studentNumber',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.studentNumber}</span>,
      },
      {
        id: 'fullName',
        header: 'Student',
        accessorKey: 'fullName',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.fullName}</p>
            <p className="text-xs text-muted-foreground">{row.original.guardianName ?? 'Guardian not recorded'}</p>
          </div>
        ),
      },
      {
        id: 'phone',
        header: 'Contact',
        accessorKey: 'phone',
        cell: ({ row }) => (
          <div>
            <p>{row.original.phone}</p>
            <p className="text-xs text-muted-foreground">{row.original.email ?? 'No email'}</p>
          </div>
        ),
      },
      {
        id: 'admissionDate',
        header: 'Admitted',
        accessorKey: 'admissionDate',
        cell: ({ row }) => dateLabel(row.original.admissionDate),
      },
      {
        id: 'portal',
        header: 'Portal',
        accessorFn: (row) => (row.hasPortalAccount ? 'Active' : 'Not created'),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.hasPortalAccount ? 'Account linked' : 'No account'}
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
        title="Students"
        description="Admissions and student records. Archived records keep their financial and academic history."
        actions={
          mode === 'front-desk' ? (
            <Button asChild>
              <Link href={`${base}/students/new`}>
                <Plus className="h-4 w-4" /> New admission
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/admin/students/new">
                <Plus className="h-4 w-4" /> Admit student
              </Link>
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-card sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by student number, name, phone or email"
            className="pl-9"
            aria-label="Search students"
          />
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="GRADUATED">Graduated</SelectItem>
              <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="w-44" aria-label="Filter by course">
              <SelectValue placeholder="Course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All courses</SelectItem>
              {(courses.data ?? []).map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <ErrorState message="The student list could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            onRowClick={(student) => router.push(`${base}/students/${student.id}`)}
            emptyTitle="No students match this view"
            emptyDescription={
              search || status !== 'ALL' || courseId !== 'ALL'
                ? 'Try clearing the search or filters.'
                : 'Admit your first student to get started.'
            }
          />
          <Pagination
            page={page}
            pageSize={20}
            total={data?.meta.total ?? 0}
            onPageChange={setPage}
          />
        </>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" /> Student numbers are allocated once and never reused.
      </p>
    </div>
  );
}
