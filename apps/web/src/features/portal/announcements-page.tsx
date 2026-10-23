'use client';

import { useQuery } from '@tanstack/react-query';
import { Megaphone } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { dateTimeLabel } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';

interface Announcement {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
}

export function PortalAnnouncementsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'announcements'],
    queryFn: async () => (await apiFetch<{ data: Announcement[] }>('/me/announcements')).data,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Announcements"
        description="Notices published by the institute for your batches."
        backHref="/student"
        backLabel="Dashboard"
      />

      {error ? (
        <ErrorState message="Announcements could not be loaded." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No announcements"
          description="Notices from the institute will appear here."
          icon={<Megaphone className="h-5 w-5" />}
        />
      ) : (
        <div className="space-y-3">
          {data?.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader>
                <CardTitle className="text-base">{announcement.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{dateTimeLabel(announcement.publishedAt)}</p>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{announcement.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
