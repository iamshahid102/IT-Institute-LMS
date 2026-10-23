'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Pencil, Plus } from 'lucide-react';
import { apiFetch, formatApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/empty-state';

interface InstructorRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  specialization: string | null;
  active: boolean;
  batchCount: number;
}

const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter the instructor name.').max(120),
  email: z.union([z.literal(''), z.email('Enter a valid email address.')]).optional(),
  phone: z.string().max(30).optional(),
  specialization: z.string().max(160).optional(),
  active: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export default function AdminInstructorsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<InstructorRow | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['instructors'],
    queryFn: async () => {
      const result = await apiFetch<{ data: InstructorRow[] }>('/instructors?pageSize=100');
      return result.data;
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', email: '', phone: '', specialization: '', active: true },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      fullName: editing?.fullName ?? '',
      email: editing?.email ?? '',
      phone: editing?.phone ?? '',
      specialization: editing?.specialization ?? '',
      active: editing?.active ?? true,
    });
    setServerError(null);
  }, [open, editing, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (editing) {
        await apiFetch(`/instructors/${editing.id}`, { method: 'PATCH', body: JSON.stringify(values) });
        toast.success('Instructor updated.');
      } else {
        await apiFetch('/instructors', { method: 'POST', body: JSON.stringify(values) });
        toast.success('Instructor added.');
      }
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      queryClient.invalidateQueries({ queryKey: ['options', 'instructors'] });
      setOpen(false);
    } catch (error) {
      setServerError(formatApiError(error));
    }
  });

  const columns = React.useMemo<ColumnDef<InstructorRow, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Instructor',
        accessorKey: 'fullName',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.fullName}</p>
            <p className="text-xs text-muted-foreground">{row.original.specialization ?? 'General'}</p>
          </div>
        ),
      },
      {
        id: 'contact',
        header: 'Contact',
        accessorFn: (row) => row.email ?? '',
        cell: ({ row }) => (
          <div className="text-sm">
            <p>{row.original.email ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{row.original.phone ?? 'No phone'}</p>
          </div>
        ),
      },
      { id: 'batches', header: 'Batches', accessorKey: 'batchCount', cell: ({ row }) => <span>{row.original.batchCount}</span> },
      {
        id: 'active',
        header: 'Status',
        accessorKey: 'active',
        cell: ({ row }) => (
          <Badge variant={row.original.active ? 'success' : 'neutral'}>{row.original.active ? 'Active' : 'Inactive'}</Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
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
        title="Instructors"
        description="Instructor profiles assigned to batches. Instructors do not have portal logins."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New instructor
          </Button>
        }
      />

      {error ? (
        <ErrorState message="Instructors could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          isLoading={isLoading}
          emptyTitle="No instructors yet"
          emptyDescription="Add instructor profiles to assign them to batches."
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit instructor' : 'New instructor'}</DialogTitle>
            <DialogDescription>Instructor details are managed by staff.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormErrorSummary message={serverError} />
            <FormField label="Full name" error={form.formState.errors.fullName?.message} required>
              <Input {...form.register('fullName')} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Email" error={form.formState.errors.email?.message}>
                <Input type="email" {...form.register('email')} />
              </FormField>
              <FormField label="Phone" error={form.formState.errors.phone?.message}>
                <Input {...form.register('phone')} />
              </FormField>
            </div>
            <FormField label="Specialization" error={form.formState.errors.specialization?.message}>
              <Input {...form.register('specialization')} placeholder="Full-stack development" />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.watch('active')} onCheckedChange={(checked) => form.setValue('active', checked === true)} />
              Active instructor
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editing ? 'Save changes' : 'Add instructor'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground">
          Deleting an instructor who is assigned to a batch is blocked by the API. Deactivate the profile instead.
        </CardContent>
      </Card>
    </div>
  );
}
