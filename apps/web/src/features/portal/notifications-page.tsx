'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, formatApiError } from '@/lib/api';
import { dateTimeLabel } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function PortalNotificationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'notifications', page],
    queryFn: async () =>
      apiFetch<{ data: Notification[]; meta: { total: number; unread: number } }>(
        `/me/notifications${qs({ page, pageSize: 20 })}`,
      ),
  });

  const markRead = async (notification: Notification) => {
    if (notification.readAt) return;
    try {
      await apiFetch(`/me/notifications/${notification.id}/read`, { method: 'PATCH' });
      queryClient.invalidateQueries({ queryKey: ['portal', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: ['portal', 'overview'] });
    } catch (markError) {
      toast.error(formatApiError(markError));
    }
  };

  const markAll = async () => {
    try {
      await apiFetch('/me/notifications/read-all', { method: 'POST' });
      toast.success('All notifications marked as read.');
      queryClient.invalidateQueries({ queryKey: ['portal', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: ['portal', 'overview'] });
    } catch (markError) {
      toast.error(formatApiError(markError));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description="In-app updates about announcements and account activity."
        backHref="/student"
        backLabel="Dashboard"
        actions={
          (data?.meta.unread ?? 0) > 0 ? (
            <Button size="sm" variant="outline" onClick={() => void markAll()}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <ErrorState message="Notifications could not be loaded." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : (data?.data.length ?? 0) === 0 ? (
        <EmptyState
          title="No notifications"
          description="You are all caught up."
          icon={<Bell className="h-5 w-5" />}
        />
      ) : (
        <>
          <div className="space-y-2">
            {data?.data.map((notification) => (
              <Card
                key={notification.id}
                className={cn(!notification.readAt && 'border-primary/30 bg-primary-soft/20')}
              >
                <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{notification.title}</p>
                    {notification.body ? (
                      <p className="mt-1 text-xs text-muted-foreground">{notification.body}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">{dateTimeLabel(notification.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!notification.readAt ? (
                      <Button size="sm" variant="ghost" onClick={() => void markRead(notification)}>
                        Mark read
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Read</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination page={page} pageSize={20} total={data?.meta.total ?? 0} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
