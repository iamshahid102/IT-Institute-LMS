'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { weekdayLabel } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import type { BatchRecord } from '@/features/academics/batch-dialog';

export default function AdminSchedulesPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['schedules', 'batches'],
    queryFn: async () => {
      const result = await apiFetch<{ data: BatchRecord[] }>('/batches?pageSize=100');
      return result.data.filter((batch) => batch.status !== 'CANCELLED');
    },
  });

  const byDay = React.useMemo(() => {
    const map = new Map<number, Array<{ batch: BatchRecord; startTime: string; endTime: string; room: string | null }>>();
    for (const batch of data ?? []) {
      for (const schedule of batch.schedules) {
        const list = map.get(schedule.dayOfWeek) ?? [];
        list.push({ batch, startTime: schedule.startTime, endTime: schedule.endTime, room: schedule.room });
        map.set(schedule.dayOfWeek, list);
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [data]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Schedules"
        description="Weekly timetable across all active and planned batches."
      />

      {error ? (
        <ErrorState message="Schedules could not be loaded." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : byDay.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No schedule slots have been defined. Add slots when creating or editing a batch.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {byDay.map(([day, slots]) => (
            <Card key={day}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="h-4 w-4 text-primary" /> {weekdayLabel(day)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {slots.map((slot) => (
                  <Link
                    key={`${slot.batch.id}-${slot.startTime}`}
                    href={`/admin/batches/${slot.batch.id}`}
                    className="block rounded-lg border p-2.5 text-sm transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{slot.batch.course.title}</p>
                      <StatusBadge status={slot.batch.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {slot.startTime}–{slot.endTime} · {slot.batch.code}
                      {slot.room ? ` · ${slot.room}` : ''}
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
