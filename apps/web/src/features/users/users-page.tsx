'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { KeyRound, Pencil, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, formatApiError } from '@/lib/api';
import { dateTimeLabel } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState } from '@/components/ui/empty-state';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface StaffRow {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

const createSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the staff member name.').max(120),
  email: z.email('Enter a valid email address.'),
  role: z.enum(['SUPER_ADMIN', 'FRONT_DESK']),
  password: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/\d/, 'Include at least one number.'),
});

const editSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the staff member name.').max(120),
  role: z.enum(['SUPER_ADMIN', 'FRONT_DESK']),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

export function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = React.useState(1);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StaffRow | null>(null);
  const [resetLink, setResetLink] = React.useState<{ name: string; url: string; expiresAt: string } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['users', page, debouncedSearch],
    queryFn: async () =>
      apiFetch<{ data: StaffRow[]; meta: { total: number } }>(
        `/users${qs({ page, pageSize: 20, search: debouncedSearch || undefined })}`,
      ),
  });

  const issueReset = async (staff: StaffRow) => {
    try {
      const result = await apiFetch<{ data: { resetUrl: string; expiresAt: string } }>(
        `/users/${staff.id}/reset-link`,
        { method: 'POST' },
      );
      setResetLink({ name: staff.fullName, url: result.data.resetUrl, expiresAt: result.data.expiresAt });
    } catch (resetError) {
      toast.error(formatApiError(resetError));
    }
  };

  const columns = React.useMemo<ColumnDef<StaffRow, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Staff member',
        accessorKey: 'fullName',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium">{row.original.fullName}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      {
        id: 'role',
        header: 'Role',
        accessorKey: 'role',
        cell: ({ row }) => (
          <Badge variant={row.original.role === 'SUPER_ADMIN' ? 'info' : 'neutral'}>
            {row.original.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Front Desk'}
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
        id: 'lastLogin',
        header: 'Last login',
        accessorKey: 'lastLoginAt',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.lastLoginAt ? dateTimeLabel(row.original.lastLoginAt) : 'Never'}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => void issueReset(row.original)}>
              <KeyRound className="h-3.5 w-3.5" /> Reset link
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(row.original)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff accounts"
        description="Create staff accounts, assign roles and manage access. Students cannot be created here."
        backHref="/admin"
        backLabel="Dashboard"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New staff account
          </Button>
        }
      />

      <div className="relative rounded-xl border bg-card p-3 shadow-card">
        <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search by name or email"
          className="pl-9"
          aria-label="Search staff"
        />
      </div>

      {error ? (
        <ErrorState message="Staff accounts could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            emptyTitle="No staff accounts"
            emptyDescription="Create the first front-desk or administrator account."
          />
          <Pagination page={page} pageSize={20} total={data?.meta.total ?? 0} onPageChange={setPage} />
        </>
      )}

      <CreateStaffDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
      />
      <EditStaffDialog
        staff={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void queryClient.invalidateQueries({ queryKey: ['users'] });
        }}
      />
      <ResetLinkDialog reset={resetLink} onClose={() => setResetLink(null)} />
    </div>
  );
}

function CreateStaffDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { fullName: '', email: '', role: 'FRONT_DESK', password: '' },
  });

  React.useEffect(() => {
    if (!open) {
      setError(null);
      form.reset({ fullName: '', email: '', role: 'FRONT_DESK', password: '' });
    }
  }, [open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await apiFetch('/users', { method: 'POST', body: JSON.stringify(values) });
      toast.success('Staff account created.');
      onCreated();
      onOpenChange(false);
    } catch (createError) {
      setError(formatApiError(createError));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New staff account</DialogTitle>
          <DialogDescription>Share the initial password securely; the user can change it after signing in.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormErrorSummary message={error} />
          <FormField label="Full name" error={form.formState.errors.fullName?.message} required>
            <Input {...form.register('fullName')} autoComplete="off" />
          </FormField>
          <FormField label="Email" error={form.formState.errors.email?.message} required>
            <Input {...form.register('email')} type="email" autoComplete="off" />
          </FormField>
          <FormField label="Role" error={form.formState.errors.role?.message} required>
            <Select
              value={form.watch('role')}
              onValueChange={(value) => form.setValue('role', value as CreateValues['role'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FRONT_DESK">Front Desk Manager</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label="Initial password"
            error={form.formState.errors.password?.message}
            hint="At least 10 characters with a letter and a number."
            required
          >
            <Input {...form.register('password')} type="text" autoComplete="new-password" />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating…' : 'Create account'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditStaffDialog({
  staff,
  onOpenChange,
  onSaved,
}: {
  staff: StaffRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { fullName: '', role: 'FRONT_DESK', status: 'ACTIVE' },
  });

  React.useEffect(() => {
    if (!staff) return;
    setError(null);
    form.reset({
      fullName: staff.fullName,
      role: staff.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'FRONT_DESK',
      status: staff.status === 'SUSPENDED' || staff.status === 'DISABLED' ? staff.status : 'ACTIVE',
    });
  }, [staff, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!staff) return;
    setError(null);
    try {
      await apiFetch(`/users/${staff.id}`, { method: 'PATCH', body: JSON.stringify(values) });
      toast.success('Staff account updated.');
      onSaved();
    } catch (updateError) {
      setError(formatApiError(updateError));
    }
  });

  return (
    <Dialog open={Boolean(staff)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit staff account</DialogTitle>
          <DialogDescription>{staff?.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormErrorSummary message={error} />
          <FormField label="Full name" error={form.formState.errors.fullName?.message} required>
            <Input {...form.register('fullName')} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Role" error={form.formState.errors.role?.message}>
              <Select
                value={form.watch('role')}
                onValueChange={(value) => form.setValue('role', value as EditValues['role'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FRONT_DESK">Front Desk Manager</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Status" error={form.formState.errors.status?.message}>
              <Select
                value={form.watch('status')}
                onValueChange={(value) => form.setValue('status', value as EditValues['status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="DISABLED">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <p className="text-xs text-muted-foreground">
            Suspending or disabling an account immediately invalidates its active sessions.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetLinkDialog({
  reset,
  onClose,
}: {
  reset: { name: string; url: string; expiresAt: string } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(reset)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Password reset link</DialogTitle>
          <DialogDescription>
            {reset ? `Share this single-use link with ${reset.name}. It expires ${dateTimeLabel(reset.expiresAt)}.` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="break-all rounded-lg border bg-muted/40 p-3 font-mono text-xs">{reset?.url}</p>
          <p className="text-xs text-muted-foreground">
            This link is shown once. Issuing another link invalidates this one.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (!reset) return;
                void navigator.clipboard
                  .writeText(reset.url)
                  .then(() => toast.success('Reset link copied.'))
                  .catch(() => toast.error('Could not copy the link. Copy it manually.'));
              }}
            >
              Copy link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
