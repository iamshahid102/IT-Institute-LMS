'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch, formatApiError } from '@/lib/api';
import { instituteWallTimeToIso, localDateInput } from '@/lib/format';
import { useBatches } from '@/features/shared/options';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const schema = z
  .object({
    batchId: z.string().min(1, 'Select a batch.'),
    date: z.string().min(1, 'Select a date.'),
    startTime: z.string().min(4, 'Enter a start time.'),
    endTime: z.string().min(4, 'Enter an end time.'),
    topic: z.string().max(160).optional(),
  })
  .refine((value) => value.endTime > value.startTime, {
    path: ['endTime'],
    message: 'The end time must be after the start time.',
  });

type FormValues = z.infer<typeof schema>;

export function SessionDialog({
  open,
  onOpenChange,
  defaultBatchId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBatchId?: string;
}) {
  const queryClient = useQueryClient();
  const batches = useBatches();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [createdId, setCreatedId] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { batchId: defaultBatchId ?? '', date: localDateInput(), startTime: '09:00', endTime: '12:00', topic: '' },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      batchId: defaultBatchId ?? '',
      date: localDateInput(),
      startTime: '09:00',
      endTime: '12:00',
      topic: '',
    });
    setServerError(null);
    setCreatedId(null);
  }, [open, defaultBatchId, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await apiFetch<{ data: { id: string } }>('/attendance/sessions', {
        method: 'POST',
        body: JSON.stringify({
          batchId: values.batchId,
          startsAt: instituteWallTimeToIso(values.date, values.startTime),
          endsAt: instituteWallTimeToIso(values.date, values.endTime),
          topic: values.topic || undefined,
        }),
      });
      toast.success('Class session created. Open it when you are ready to mark attendance.');
      setCreatedId(result.data.id);
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    } catch (error) {
      setServerError(formatApiError(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New class session</DialogTitle>
          <DialogDescription>
            Sessions start as scheduled. Attendance can only be marked while a session is open.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormErrorSummary message={serverError} />
          <FormField label="Batch" error={form.formState.errors.batchId?.message} required>
            <Select value={form.watch('batchId')} onValueChange={(value) => form.setValue('batchId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a batch" />
              </SelectTrigger>
              <SelectContent>
                {(batches.data ?? [])
                  .filter((batch) => batch.status !== 'CANCELLED')
                  .map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.course.title} · {batch.code}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Date" error={form.formState.errors.date?.message} required>
              <Input type="date" {...form.register('date')} />
            </FormField>
            <FormField label="Start" error={form.formState.errors.startTime?.message} required>
              <Input type="time" {...form.register('startTime')} />
            </FormField>
            <FormField label="End" error={form.formState.errors.endTime?.message} required>
              <Input type="time" {...form.register('endTime')} />
            </FormField>
          </div>
          <FormField label="Topic" error={form.formState.errors.topic?.message}>
            <Input {...form.register('topic')} placeholder="Authentication and sessions" />
          </FormField>
          <p className="text-xs text-muted-foreground">Times are entered in institute time (Asia/Karachi).</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {createdId ? 'Close' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating…' : 'Create session'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
