'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { ClipboardList, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, formatApiError } from '@/lib/api';
import { dateLabel, localDateInput } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { useBatches, useCourses } from '@/features/shared/options';

interface AssessmentRow {
  id: string;
  title: string;
  maxMarks: number;
  passMarks: number;
  assessmentDate: string;
  status: string;
  course: { id: string; code: string; title: string };
  batchId: string | null;
  _count: { results: number };
}

interface AssessmentDetail extends AssessmentRow {
  results: Array<{
    id: string;
    enrollmentId: string;
    marksObtained: number;
    status: string;
    remarks: string | null;
    enrollment: { student: { studentNumber: string; fullName: string } };
  }>;
  eligibleEnrollments: Array<{
    id: string;
    status: string;
    student: { id: string; studentNumber: string; fullName: string };
  }>;
}

const schema = z
  .object({
    courseId: z.string().min(1, 'Select a course.'),
    batchId: z.string().optional(),
    title: z.string().trim().min(3, 'Enter the assessment title.').max(160),
    maxMarks: z.string().refine((value) => Number(value) >= 1, 'Enter the maximum marks.'),
    passMarks: z.string().refine((value) => Number(value) >= 0, 'Enter the pass marks.'),
    assessmentDate: z.string().min(1, 'Select the assessment date.'),
    status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']),
  })
  .refine((value) => Number(value.passMarks) <= Number(value.maxMarks), {
    path: ['passMarks'],
    message: 'Pass marks cannot exceed the maximum.',
  });

type FormValues = z.infer<typeof schema>;

export function AssessmentsPage({ mode }: { mode: 'admin' | 'front-desk' }) {
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const { can } = useAuth();
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState('ALL');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['assessments', page, status],
    queryFn: async () =>
      apiFetch<{ data: AssessmentRow[]; meta: { total: number } }>(
        `/assessments${qs({ page, pageSize: 20, status: status === 'ALL' ? undefined : status })}`,
      ),
  });

  const columns = React.useMemo<ColumnDef<AssessmentRow, unknown>[]>(
    () => [
      {
        id: 'title',
        header: 'Assessment',
        accessorKey: 'title',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium">{row.original.title}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.course.code} · {dateLabel(row.original.assessmentDate)}
            </p>
          </div>
        ),
      },
      {
        id: 'marks',
        header: 'Marks',
        accessorFn: (row) => row.maxMarks,
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.passMarks} / {row.original.maxMarks} to pass
          </span>
        ),
      },
      {
        id: 'results',
        header: 'Results',
        accessorFn: (row) => row._count.results,
        cell: ({ row }) => (
          <Badge variant={row.original._count.results > 0 ? 'info' : 'neutral'}>
            {row.original._count.results} recorded
          </Badge>
        ),
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
          <Button size="sm" variant="ghost" onClick={() => setDetailId(row.original.id)}>
            {can('assessment.manage') ? 'Results' : 'View'}
          </Button>
        ),
      },
    ],
    [can],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assessments"
        description="Record marks for enrolled students. Pass status is derived from the configured pass marks."
        backHref={base}
        backLabel="Dashboard"
        actions={
          can('assessment.manage') ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New assessment
            </Button>
          ) : undefined
        }
      />

      <div className="flex justify-end">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label="Assessment status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState message="Assessments could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            emptyTitle="No assessments yet"
            emptyDescription="Create an assessment to record student marks."
          />
          <Pagination page={page} pageSize={20} total={data?.meta.total ?? 0} onPageChange={setPage} />
        </>
      )}

      <AssessmentDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void refetch()} />
      <ResultsDialog assessmentId={detailId} onClose={() => setDetailId(null)} onSaved={() => void refetch()} />
    </div>
  );
}

function AssessmentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const courses = useCourses({ includeAll: true });
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      courseId: '',
      batchId: '',
      title: '',
      maxMarks: '100',
      passMarks: '50',
      assessmentDate: localDateInput(),
      status: 'DRAFT',
    },
  });

  const courseId = form.watch('courseId');
  const batches = useBatches(courseId || undefined);

  React.useEffect(() => {
    if (!open) {
      setServerError(null);
      form.reset({
        courseId: '',
        batchId: '',
        title: '',
        maxMarks: '100',
        passMarks: '50',
        assessmentDate: localDateInput(),
        status: 'DRAFT',
      });
    }
  }, [open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await apiFetch('/assessments', {
        method: 'POST',
        body: JSON.stringify({
          courseId: values.courseId,
          batchId: values.batchId || null,
          title: values.title,
          maxMarks: Number(values.maxMarks),
          passMarks: Number(values.passMarks),
          assessmentDate: values.assessmentDate,
          status: values.status,
        }),
      });
      toast.success('Assessment created.');
      onCreated();
      onOpenChange(false);
    } catch (error) {
      setServerError(formatApiError(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New assessment</DialogTitle>
          <DialogDescription>Scope the assessment to a course or a specific batch.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormErrorSummary message={serverError} />
          <FormField label="Title" error={form.formState.errors.title?.message} required>
            <Input {...form.register('title')} placeholder="Mid-term theory exam" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Course" error={form.formState.errors.courseId?.message} required>
              <Select
                value={form.watch('courseId')}
                onValueChange={(value) => {
                  form.setValue('courseId', value);
                  form.setValue('batchId', '');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {(courses.data ?? []).map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.code} · {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Batch" hint="Leave empty to apply to all batches of the course.">
              <Select
                value={form.watch('batchId') || 'ALL'}
                onValueChange={(value) => form.setValue('batchId', value === 'ALL' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All batches</SelectItem>
                  {(batches.data ?? []).map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Maximum marks" error={form.formState.errors.maxMarks?.message} required>
              <Input {...form.register('maxMarks')} inputMode="numeric" />
            </FormField>
            <FormField label="Pass marks" error={form.formState.errors.passMarks?.message} required>
              <Input {...form.register('passMarks')} inputMode="numeric" />
            </FormField>
            <FormField label="Assessment date" error={form.formState.errors.assessmentDate?.message} required>
              <Input type="date" {...form.register('assessmentDate')} />
            </FormField>
            <FormField label="Status" error={form.formState.errors.status?.message}>
              <Select
                value={form.watch('status')}
                onValueChange={(value) => form.setValue('status', value as FormValues['status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating…' : 'Create assessment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResultsDialog({
  assessmentId,
  onClose,
  onSaved,
}: {
  assessmentId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [marks, setMarks] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['assessment', assessmentId],
    queryFn: async () => (await apiFetch<{ data: AssessmentDetail }>(`/assessments/${assessmentId}`)).data,
    enabled: Boolean(assessmentId),
  });

  React.useEffect(() => {
    if (!data) return;
    const initial: Record<string, string> = {};
    for (const result of data.results) initial[result.enrollmentId] = String(result.marksObtained);
    setMarks(initial);
    setError(null);
  }, [data]);

  const save = async () => {
    if (!data) return;
    const results = Object.entries(marks)
      .filter(([, value]) => value.trim() !== '')
      .map(([enrollmentId, value]) => ({ enrollmentId, marksObtained: Number(value) }));

    if (results.length === 0) {
      setError('Enter at least one mark.');
      return;
    }
    if (results.some((result) => Number.isNaN(result.marksObtained) || result.marksObtained < 0)) {
      setError('Marks must be zero or a positive number.');
      return;
    }
    if (results.some((result) => result.marksObtained > data.maxMarks)) {
      setError(`Marks cannot exceed ${data.maxMarks}.`);
      return;
    }

    setPending(true);
    setError(null);
    try {
      await apiFetch(`/assessments/${data.id}/results`, {
        method: 'PUT',
        body: JSON.stringify({ results }),
      });
      toast.success('Assessment results saved.');
      queryClient.invalidateQueries({ queryKey: ['assessment', data.id] });
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      onSaved();
      onClose();
    } catch (saveError) {
      setError(formatApiError(saveError));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={Boolean(assessmentId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{data?.title ?? 'Assessment results'}</DialogTitle>
          <DialogDescription>
            {data
              ? `${data.course.title} · pass at ${data.passMarks} of ${data.maxMarks} · ${dateLabel(data.assessmentDate)}`
              : 'Loading assessment…'}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <LoadingSkeleton rows={4} />
        ) : (
          <div className="space-y-4">
            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
            ) : null}
            <div className="flex items-center gap-2">
              <StatusBadge status={data.status} />
              <span className="text-xs text-muted-foreground">
                {data.results.length} of {data.eligibleEnrollments.length} students have results
              </span>
            </div>
            <div className="max-h-80 divide-y overflow-y-auto rounded-lg border">
              {data.eligibleEnrollments.length === 0 ? (
                <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <ClipboardList className="h-4 w-4" /> No eligible enrollments for this assessment.
                </p>
              ) : (
                data.eligibleEnrollments.map((enrollment) => {
                  const existing = data.results.find((result) => result.enrollmentId === enrollment.id);
                  return (
                    <div key={enrollment.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{enrollment.student.fullName}</p>
                        <p className="font-mono text-xs text-muted-foreground">{enrollment.student.studentNumber}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {existing ? <StatusBadge status={existing.status} /> : null}
                        <Input
                          value={marks[enrollment.id] ?? ''}
                          onChange={(event) =>
                            setMarks((current) => ({ ...current, [enrollment.id]: event.target.value }))
                          }
                          inputMode="numeric"
                          placeholder="—"
                          className="w-20 text-right"
                          aria-label={`Marks for ${enrollment.student.fullName}`}
                          disabled={!can('assessment.manage') || data.status === 'CLOSED'}
                        />
                        <span className="text-xs text-muted-foreground">/ {data.maxMarks}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {can('assessment.manage') && data.status !== 'CLOSED' ? (
                <Button onClick={() => void save()} disabled={pending}>
                  {pending ? 'Saving…' : 'Save results'}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
