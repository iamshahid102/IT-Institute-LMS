'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Pencil, Plus, Send } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, formatApiError } from '@/lib/api';
import { dateTimeLabel } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Pagination } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ErrorState, EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { useBatches } from '@/features/shared/options';

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  audience: string;
  batchId: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  createdBy: { id: string; fullName: string } | null;
}

const schema = z.object({
  title: z.string().trim().min(3, 'Enter a title.').max(160),
  body: z.string().trim().min(10, 'Write at least a sentence.').max(5000),
  audience: z.enum(['EVERYONE', 'STUDENTS', 'STAFF']),
  batchId: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
});

type FormValues = z.infer<typeof schema>;

export function AnnouncementsPage({ mode }: { mode: 'admin' | 'front-desk' }) {
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);
  const [editing, setEditing] = React.useState<AnnouncementRow | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['announcements', page],
    queryFn: async () =>
      apiFetch<{ data: AnnouncementRow[]; meta: { total: number } }>(
        `/announcements${qs({ page, pageSize: 20 })}`,
      ),
  });

  const publish = async (announcement: AnnouncementRow) => {
    try {
      await apiFetch(`/announcements/${announcement.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PUBLISHED' }),
      });
      toast.success('Announcement published.');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    } catch (publishError) {
      toast.error(formatApiError(publishError));
    }
  };

  const archive = async (announcement: AnnouncementRow) => {
    try {
      await apiFetch(`/announcements/${announcement.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ARCHIVED' }),
      });
      toast.success('Announcement archived.');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    } catch (archiveError) {
      toast.error(formatApiError(archiveError));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Announcements"
        description="Publish notices to all students, specific batches or staff."
        backHref={base}
        backLabel="Dashboard"
        actions={
          can('announcement.manage') ? (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New announcement
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <ErrorState message="Announcements could not be loaded." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : (data?.data.length ?? 0) === 0 ? (
        <EmptyState
          title="No announcements"
          description="Published announcements appear on the student portal and create in-app notifications."
          icon={<Megaphone className="h-5 w-5" />}
        />
      ) : (
        <>
          <div className="space-y-3">
            {data?.data.map((announcement) => (
              <Card key={announcement.id}>
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{announcement.title}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {announcement.audience === 'EVERYONE'
                        ? 'Everyone'
                        : announcement.audience === 'STUDENTS'
                          ? 'Students'
                          : 'Staff'}
                      {announcement.publishedAt ? ` · published ${dateTimeLabel(announcement.publishedAt)}` : ''}
                      {announcement.createdBy ? ` · ${announcement.createdBy.fullName}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={announcement.status} />
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{announcement.body}</p>
                  {can('announcement.manage') && announcement.status !== 'ARCHIVED' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(announcement);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      {announcement.status === 'DRAFT' ? (
                        <Button size="sm" onClick={() => void publish(announcement)}>
                          <Send className="h-3.5 w-3.5" /> Publish
                        </Button>
                      ) : (
                        <ConfirmDialog
                          trigger={
                            <Button size="sm" variant="ghost">
                              Archive
                            </Button>
                          }
                          title="Archive this announcement?"
                          description="Archived announcements are removed from the student feed. The record is retained."
                          confirmLabel="Archive"
                          onConfirm={() => archive(announcement)}
                        />
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination page={page} pageSize={20} total={data?.meta.total ?? 0} onPageChange={setPage} />
        </>
      )}

      <AnnouncementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        announcement={editing}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['announcements'] })}
      />
    </div>
  );
}

function AnnouncementDialog({
  open,
  onOpenChange,
  announcement,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: AnnouncementRow | null;
  onSaved: () => void;
}) {
  const batches = useBatches();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', body: '', audience: 'STUDENTS', batchId: '', status: 'PUBLISHED' },
  });

  React.useEffect(() => {
    if (!open) return;
    setServerError(null);
    form.reset({
      title: announcement?.title ?? '',
      body: announcement?.body ?? '',
      audience: (announcement?.audience as FormValues['audience']) ?? 'STUDENTS',
      batchId: announcement?.batchId ?? '',
      status: (announcement?.status as FormValues['status']) ?? 'PUBLISHED',
    });
  }, [open, announcement, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const payload = {
        title: values.title,
        body: values.body,
        audience: values.audience,
        batchId: values.batchId || null,
        status: values.status,
      };
      if (announcement) {
        await apiFetch(`/announcements/${announcement.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success('Announcement updated.');
      } else {
        await apiFetch('/announcements', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Announcement created.');
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      setServerError(formatApiError(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{announcement ? 'Edit announcement' : 'New announcement'}</DialogTitle>
          <DialogDescription>Publishing creates in-app notifications for the targeted audience.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormErrorSummary message={serverError} />
          <FormField label="Title" error={form.formState.errors.title?.message} required>
            <Input {...form.register('title')} placeholder="Mid-term exam schedule" />
          </FormField>
          <FormField label="Message" error={form.formState.errors.body?.message} required>
            <Textarea {...form.register('body')} rows={6} placeholder="Write the announcement…" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Audience">
              <Select
                value={form.watch('audience')}
                onValueChange={(value) => form.setValue('audience', value as FormValues['audience'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENTS">Students</SelectItem>
                  <SelectItem value="STAFF">Staff</SelectItem>
                  <SelectItem value="EVERYONE">Everyone</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Batch" hint="Optional target batch.">
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
            <FormField label="Status">
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
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saving…' : announcement ? 'Save changes' : 'Create announcement'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
