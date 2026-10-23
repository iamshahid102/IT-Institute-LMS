'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, UserRound } from 'lucide-react';
import { toMinorUnits } from '@lms/shared';
import { apiFetch, formatApiError } from '@/lib/api';
import { localDateInput, money } from '@/lib/format';
import { useBatches, useStudentSearch } from '@/features/shared/options';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const schema = z.object({
  batchId: z.string().min(1, 'Select a batch.'),
  joinedAt: z.string().min(1, 'Select the joining date.'),
  fee: z
    .string()
    .min(1, 'Enter the agreed fee.')
    .refine((value) => toMinorUnits(value) !== null, 'Enter a valid amount, for example 60000.00.'),
  status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'WITHDRAWN', 'SUSPENDED']),
});

type FormValues = z.infer<typeof schema>;

interface EnrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId?: string;
  studentName?: string;
  onEnrolled?: () => void;
}

export function EnrollDialog({ open, onOpenChange, studentId, studentName, onEnrolled }: EnrollDialogProps) {
  const queryClient = useQueryClient();
  const batches = useBatches();
  const [studentSearch, setStudentSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(studentSearch, 300);
  const students = useStudentSearch(debouncedSearch);
  const [selectedStudent, setSelectedStudent] = React.useState<{ id: string; fullName: string; studentNumber: string } | null>(
    studentId && studentName ? { id: studentId, fullName: studentName, studentNumber: '' } : null,
  );
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { batchId: '', joinedAt: localDateInput(), fee: '', status: 'ACTIVE' },
  });

  const batchId = form.watch('batchId');

  React.useEffect(() => {
    if (!batchId) return;
    const batch = batches.data?.find((item) => item.id === batchId);
    const fee = batch?.course?.defaultFeeMinor;
    if (fee && !form.getValues('fee')) {
      form.setValue('fee', (fee / 100).toFixed(2));
    }
  }, [batchId, batches.data, form]);

  React.useEffect(() => {
    if (!open) {
      form.reset({ batchId: '', joinedAt: localDateInput(), fee: '', status: 'ACTIVE' });
      setServerError(null);
      if (!studentId) setSelectedStudent(null);
    }
  }, [open, form, studentId]);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    if (!selectedStudent) {
      setServerError('Select a student before enrolling.');
      return;
    }
    const feeMinor = toMinorUnits(values.fee);
    if (feeMinor === null) {
      setServerError('Enter a valid agreed fee.');
      return;
    }
    try {
      await apiFetch('/enrollments', {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudent.id,
          batchId: values.batchId,
          joinedAt: values.joinedAt,
          agreedFeeMinor: feeMinor,
          status: values.status,
        }),
      });
      toast.success('Student enrolled.');
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['student'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      onOpenChange(false);
      onEnrolled?.();
    } catch (error) {
      setServerError(formatApiError(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Enroll in a batch</DialogTitle>
          <DialogDescription>
            The agreed fee is recorded on the enrollment and is the source of truth for invoices.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormErrorSummary message={serverError} />

          {studentId ? (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{studentName}</p>
              <p className="text-xs text-muted-foreground">Enrolling the selected student</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">Student</p>
              {selectedStudent ? (
                <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <span className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-primary" />
                    {selectedStudent.fullName}
                    {selectedStudent.studentNumber ? (
                      <span className="text-xs text-muted-foreground">{selectedStudent.studentNumber}</span>
                    ) : null}
                  </span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedStudent(null)}>
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={studentSearch}
                      onChange={(event) => setStudentSearch(event.target.value)}
                      placeholder="Search by name, student number or phone"
                      className="pl-9"
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto rounded-lg border">
                    {students.isLoading ? (
                      <Skeleton className="m-2 h-10" />
                    ) : (students.data?.length ?? 0) === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground">No students match that search.</p>
                    ) : (
                      students.data?.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() =>
                            setSelectedStudent({
                              id: student.id,
                              fullName: student.fullName,
                              studentNumber: student.studentNumber,
                            })
                          }
                          className={cn(
                            'flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50',
                          )}
                        >
                          <span>{student.fullName}</span>
                          <span className="font-mono text-xs text-muted-foreground">{student.studentNumber}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Batch" htmlFor="batchId" error={form.formState.errors.batchId?.message} required className="sm:col-span-2">
              <Select value={batchId} onValueChange={(value) => form.setValue('batchId', value)}>
                <SelectTrigger id="batchId">
                  <SelectValue placeholder={batches.isLoading ? 'Loading batches…' : 'Select a batch'} />
                </SelectTrigger>
                <SelectContent>
                  {(batches.data ?? [])
                    .filter((batch) => batch.status === 'ACTIVE' || batch.status === 'PLANNED')
                    .map((batch) => (
                      <SelectItem key={batch.id} value={batch.id} disabled={batch.enrolledCount >= batch.capacity}>
                        {batch.course.title} · {batch.code} ({batch.enrolledCount}/{batch.capacity})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Joining date" htmlFor="joinedAt" error={form.formState.errors.joinedAt?.message} required>
              <Input id="joinedAt" type="date" {...form.register('joinedAt')} />
            </FormField>
            <FormField
              label="Agreed fee (PKR)"
              htmlFor="fee"
              error={form.formState.errors.fee?.message}
              hint={
                batchId
                  ? `Course default: ${money(
                      batches.data?.find((batch) => batch.id === batchId)?.course?.defaultFeeMinor ?? 0,
                    )}`
                  : 'Amount agreed at admission'
              }
              required
            >
              <Input id="fee" inputMode="decimal" placeholder="60000.00" {...form.register('fee')} />
            </FormField>
            <FormField label="Initial status" htmlFor="status" error={form.formState.errors.status?.message}>
              <Select
                value={form.watch('status')}
                onValueChange={(value) => form.setValue('status', value as FormValues['status'])}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Enrolling…' : 'Enroll student'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
