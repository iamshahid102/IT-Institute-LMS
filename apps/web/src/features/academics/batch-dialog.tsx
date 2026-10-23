'use client';

import * as React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch, formatApiError } from '@/lib/api';
import { localDateInput } from '@/lib/format';
import { useCourses, useInstructors } from '@/features/shared/options';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const scheduleRow = z.object({
  dayOfWeek: z.string(),
  startTime: z.string().min(4, 'Start time is required.'),
  endTime: z.string().min(4, 'End time is required.'),
  room: z.string().max(60).optional(),
});

const schema = z.object({
  courseId: z.string().min(1, 'Select a course.'),
  instructorId: z.string(),
  code: z.string().trim().regex(/^[A-Za-z0-9-]{2,30}$/, 'Use 2–30 letters, numbers or dashes.'),
  name: z.string().trim().min(3, 'Enter the batch name.').max(160),
  startDate: z.string().min(1, 'Select a start date.'),
  endDate: z.string().min(1, 'Select an end date.'),
  capacity: z.string().refine((value) => Number(value) >= 1 && Number(value) <= 500, 'Capacity 1–500.'),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']),
  schedules: z.array(scheduleRow),
}).refine((value) => value.endDate >= value.startDate, {
  path: ['endDate'],
  message: 'The end date must be on or after the start date.',
});

type FormValues = z.infer<typeof schema>;

export interface BatchRecord {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  enrolledCount?: number;
  status: string;
  notes: string | null;
  course: { id: string; code: string; title: string };
  instructor: { id: string; fullName: string } | null;
  schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string; room: string | null }>;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function BatchDialog({
  open,
  onOpenChange,
  batch,
  defaultCourseId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch?: BatchRecord | null;
  defaultCourseId?: string;
}) {
  const queryClient = useQueryClient();
  const courses = useCourses({ includeAll: true });
  const instructors = useInstructors();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      courseId: batch?.course.id ?? defaultCourseId ?? '',
      instructorId: batch?.instructor?.id ?? 'NONE',
      code: batch?.code ?? '',
      name: batch?.name ?? '',
      startDate: batch?.startDate?.slice(0, 10) ?? localDateInput(),
      endDate: batch?.endDate?.slice(0, 10) ?? localDateInput(new Date(Date.now() + 90 * 864e5)),
      capacity: String(batch?.capacity ?? 25),
      status: (batch?.status as FormValues['status']) ?? 'PLANNED',
      schedules:
        batch?.schedules.map((schedule) => ({
          dayOfWeek: String(schedule.dayOfWeek),
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          room: schedule.room ?? '',
        })) ?? [{ dayOfWeek: '1', startTime: '09:00', endTime: '12:00', room: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'schedules' });

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      courseId: batch?.course.id ?? defaultCourseId ?? '',
      instructorId: batch?.instructor?.id ?? 'NONE',
      code: batch?.code ?? '',
      name: batch?.name ?? '',
      startDate: batch?.startDate?.slice(0, 10) ?? localDateInput(),
      endDate: batch?.endDate?.slice(0, 10) ?? localDateInput(new Date(Date.now() + 90 * 864e5)),
      capacity: String(batch?.capacity ?? 25),
      status: (batch?.status as FormValues['status']) ?? 'PLANNED',
      schedules:
        batch?.schedules.map((schedule) => ({
          dayOfWeek: String(schedule.dayOfWeek),
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          room: schedule.room ?? '',
        })) ?? [{ dayOfWeek: '1', startTime: '09:00', endTime: '12:00', room: '' }],
    });
    setServerError(null);
  }, [open, batch, defaultCourseId, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const schedules = values.schedules.map((schedule) => ({
      dayOfWeek: Number(schedule.dayOfWeek),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      room: schedule.room || undefined,
    }));

    try {
      if (batch) {
        await apiFetch(`/batches/${batch.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            instructorId: values.instructorId === 'NONE' ? null : values.instructorId,
            name: values.name,
            startDate: values.startDate,
            endDate: values.endDate,
            capacity: Number(values.capacity),
            status: values.status,
            schedules,
          }),
        });
        toast.success('Batch updated.');
      } else {
        await apiFetch('/batches', {
          method: 'POST',
          body: JSON.stringify({
            courseId: values.courseId,
            instructorId: values.instructorId === 'NONE' ? null : values.instructorId,
            code: values.code.toUpperCase(),
            name: values.name,
            startDate: values.startDate,
            endDate: values.endDate,
            capacity: Number(values.capacity),
            status: values.status,
            schedules,
          }),
        });
        toast.success('Batch created.');
      }
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['options'] });
      onOpenChange(false);
    } catch (error) {
      setServerError(formatApiError(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{batch ? 'Edit batch' : 'New batch'}</DialogTitle>
          <DialogDescription>
            Batches connect a course, instructor, schedule and enrolled students.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormErrorSummary message={serverError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Course" error={form.formState.errors.courseId?.message} required>
              <Select
                value={form.watch('courseId')}
                onValueChange={(value) => form.setValue('courseId', value)}
                disabled={Boolean(batch)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {(courses.data ?? []).map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Instructor">
              <Select
                value={form.watch('instructorId')}
                onValueChange={(value) => form.setValue('instructorId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Unassigned</SelectItem>
                  {(instructors.data ?? [])
                    .filter((instructor) => instructor.active)
                    .map((instructor) => (
                      <SelectItem key={instructor.id} value={instructor.id}>
                        {instructor.fullName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Batch code" error={form.formState.errors.code?.message} required>
              <Input {...form.register('code')} placeholder="WEB-2026-A" disabled={Boolean(batch)} />
            </FormField>
            <FormField label="Batch name" error={form.formState.errors.name?.message} required>
              <Input {...form.register('name')} placeholder="Web Development — Morning A" />
            </FormField>
            <FormField label="Start date" error={form.formState.errors.startDate?.message} required>
              <Input type="date" {...form.register('startDate')} />
            </FormField>
            <FormField label="End date" error={form.formState.errors.endDate?.message} required>
              <Input type="date" {...form.register('endDate')} />
            </FormField>
            <FormField label="Capacity" error={form.formState.errors.capacity?.message} required>
              <Input {...form.register('capacity')} inputMode="numeric" />
            </FormField>
            <FormField label="Status">
              <Select
                value={form.watch('status')}
                onValueChange={(value) => form.setValue('status', value as FormValues['status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANNED">Planned</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Weekly schedule</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => append({ dayOfWeek: '1', startTime: '09:00', endTime: '12:00', room: '' })}
              >
                <Plus className="h-3.5 w-3.5" /> Add slot
              </Button>
            </div>
            {fields.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                No schedule added. You can add slots later.
              </p>
            ) : null}
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1.2fr_0.8fr_0.8fr_1fr_36px]">
                <FormField label="Day">
                  <Select
                    value={form.watch(`schedules.${index}.dayOfWeek`)}
                    onValueChange={(value) => form.setValue(`schedules.${index}.dayOfWeek`, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((day, dayIndex) => (
                        <SelectItem key={day} value={String(dayIndex)}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Start" error={form.formState.errors.schedules?.[index]?.startTime?.message}>
                  <Input type="time" {...form.register(`schedules.${index}.startTime`)} />
                </FormField>
                <FormField label="End" error={form.formState.errors.schedules?.[index]?.endTime?.message}>
                  <Input type="time" {...form.register(`schedules.${index}.endTime`)} />
                </FormField>
                <FormField label="Room">
                  <Input {...form.register(`schedules.${index}.room`)} placeholder="Lab 1" />
                </FormField>
                <div className="flex items-end pb-1">
                  <Button type="button" size="icon" variant="ghost" aria-label="Remove slot" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {batch ? 'Save batch' : 'Create batch'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
