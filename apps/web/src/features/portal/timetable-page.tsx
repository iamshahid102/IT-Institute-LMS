'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { dateTimeLabel, weekdayLabel } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';

interface TimetableEntry {
  enrollmentId: string;
  batch: { id: string; code: string; name: string; courseTitle: string; instructor: string | null };
  schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string; room: string | null }>;
  upcomingSessions: Array<{ id: string; startsAt: string; endsAt: string; status: string; topic: string | null }>;
}

export function PortalTimetablePage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'timetable'],
    queryFn: async () => (await apiFetch<{ data: TimetableEntry[] }>('/me/timetable')).data,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Batches & timetable"
        description="Your weekly schedule and the next scheduled class sessions."
        backHref="/student"
        backLabel="Dashboard"
      />

      {error ? (
        <ErrorState message="Your timetable could not be loaded." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No active batches"
          description="Your timetable appears once you are enrolled in an active batch."
          icon={<CalendarDays className="h-5 w-5" />}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data?.map((entry) => (
            <Card key={entry.enrollmentId}>
              <CardHeader>
                <CardTitle className="text-base">{entry.batch.courseTitle}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {entry.batch.name} · {entry.batch.code}
                  {entry.batch.instructor ? ` · ${entry.batch.instructor}` : ''}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Weekly schedule</p>
                  {entry.schedules.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">No schedule slots defined.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {entry.schedules.map((schedule) => (
                        <li
                          key={`${schedule.dayOfWeek}-${schedule.startTime}`}
                          className="flex items-center justify-between rounded-lg border p-2.5 text-sm"
                        >
                          <span className="font-medium">{weekdayLabel(schedule.dayOfWeek)}</span>
                          <span className="text-muted-foreground">
                            {schedule.startTime}–{schedule.endTime}
                            {schedule.room ? ` · ${schedule.room}` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Upcoming sessions</p>
                  {entry.upcomingSessions.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">No upcoming sessions scheduled.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {entry.upcomingSessions.map((session) => (
                        <li key={session.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                          <div>
                            <p className="text-sm font-medium">{session.topic ?? 'Class session'}</p>
                            <p className="text-xs text-muted-foreground">{dateTimeLabel(session.startsAt)}</p>
                          </div>
                          <StatusBadge status={session.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
