'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toMinorUnits } from '@lms/shared';
import { apiFetch, formatApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const schema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9-]{2,20}$/, 'Use 2–20 letters, numbers or dashes.'),
  title: z.string().trim().min(3, 'Enter the course title.').max(160),
  durationValue: z.string().refine((value) => Number(value) >= 1 && Number(value) <= 520, 'Enter a duration.'),
  durationUnit: z.enum(['WEEKS', 'MONTHS']),
  fee: z.string().optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
});

type FormValues = z.infer<typeof schema>;

export interface CourseRecord {
  id: string;
  code: string;
  title: string;
  description: string | null;
  durationValue: number;
  durationUnit: string;
  defaultFeeMinor: number | null;
  status: string;
}

export function CourseDialog({
  open,
  onOpenChange,
  course,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course?: CourseRecord | null;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: course?.code ?? '',
      title: course?.title ?? '',
      durationValue: String(course?.durationValue ?? 12),
      durationUnit: (course?.durationUnit as 'WEEKS' | 'MONTHS') ?? 'WEEKS',
      fee: course?.defaultFeeMinor ? (course.defaultFeeMinor / 100).toFixed(2) : '',
      description: course?.description ?? '',
      status: (course?.status as FormValues['status']) ?? 'ACTIVE',
    },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      code: course?.code ?? '',
      title: course?.title ?? '',
      durationValue: String(course?.durationValue ?? 12),
      durationUnit: (course?.durationUnit as 'WEEKS' | 'MONTHS') ?? 'WEEKS',
      fee: course?.defaultFeeMinor ? (course.defaultFeeMinor / 100).toFixed(2) : '',
      description: course?.description ?? '',
      status: (course?.status as FormValues['status']) ?? 'ACTIVE',
    });
    setServerError(null);
  }, [open, course, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const feeMinor = values.fee ? toMinorUnits(values.fee) : null;
    if (values.fee && feeMinor === null) {
      setServerError('Enter a valid default fee.');
      return;
    }
    const payload = {
      code: values.code.toUpperCase(),
      title: values.title,
      description: values.description || undefined,
      durationValue: Number(values.durationValue),
      durationUnit: values.durationUnit,
      defaultFeeMinor: feeMinor ?? undefined,
      status: values.status,
    };

    try {
      if (course) {
        await apiFetch(`/courses/${course.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success('Course updated.');
      } else {
        await apiFetch('/courses', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Course created.');
      }
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['options'] });
      onOpenChange(false);
    } catch (error) {
      setServerError(formatApiError(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{course ? 'Edit course' : 'New course'}</DialogTitle>
          <DialogDescription>
            Courses define duration and the default fee used when creating batches and enrollments.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormErrorSummary message={serverError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Course code" htmlFor="code" error={form.formState.errors.code?.message} required>
              <Input id="code" {...form.register('code')} placeholder="WEB-101" disabled={Boolean(course)} />
            </FormField>
            <FormField label="Status" htmlFor="status">
              <Select
                value={form.watch('status')}
                onValueChange={(value) => form.setValue('status', value as FormValues['status'])}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Title" htmlFor="title" error={form.formState.errors.title?.message} className="sm:col-span-2" required>
              <Input id="title" {...form.register('title')} placeholder="Full-Stack Web Development" />
            </FormField>
            <FormField label="Duration" htmlFor="durationValue" error={form.formState.errors.durationValue?.message} required>
              <Input id="durationValue" {...form.register('durationValue')} inputMode="numeric" />
            </FormField>
            <FormField label="Duration unit" htmlFor="durationUnit">
              <Select
                value={form.watch('durationUnit')}
                onValueChange={(value) => form.setValue('durationUnit', value as 'WEEKS' | 'MONTHS')}
              >
                <SelectTrigger id="durationUnit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKS">Weeks</SelectItem>
                  <SelectItem value="MONTHS">Months</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label="Default fee (PKR)"
              htmlFor="fee"
              error={form.formState.errors.fee?.message}
              hint="Used to prefill enrollment and installment amounts."
            >
              <Input id="fee" {...form.register('fee')} inputMode="decimal" placeholder="60000.00" />
            </FormField>
            <FormField label="Description" htmlFor="description" className="sm:col-span-2">
              <Textarea id="description" rows={3} {...form.register('description')} />
            </FormField>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {course ? 'Save course' : 'Create course'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
