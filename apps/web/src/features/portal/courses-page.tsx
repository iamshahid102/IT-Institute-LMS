'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BookOpen, CalendarDays, UserRound } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { dateLabel, money, percent, weekdayLabel } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';

interface Enrollment {
  id: string;
  status: string;
  joinedAt: string;
  completedAt: string | null;
  agreedFeeMinor: number;
  currency: string;
  attendance: { percentage: number } | null;
  fees: { billedMinor: number; paidMinor: number; outstandingMinor: number; nextDueAt: string | null };
  batch: {
    id: string;
    code: string;
    name: string;
    startDate: string;
    endDate: string;
    course: { code: string; title: string; durationValue: number; durationUnit: string };
    instructor: { fullName: string } | null;
    schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string; room: string | null }>;
  };
}

export function PortalCoursesPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'enrollments'],
    queryFn: async () => (await apiFetch<{ data: Enrollment[] }>('/me/enrollments')).data,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="My courses"
        description="Your enrollments, batches, instructors and fee position."
        backHref="/student"
        backLabel="Dashboard"
      />

      {error ? (
        <ErrorState message="Your courses could not be loaded." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No enrollments yet"
          description="Once the front desk enrolls you in a batch, your course details will appear here."
          icon={<BookOpen className="h-5 w-5" />}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data?.map((enrollment) => (
            <Card key={enrollment.id}>
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">{enrollment.batch.course.title}</CardTitle>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {enrollment.batch.course.code} · {enrollment.batch.code}
                  </p>
                </div>
                <StatusBadge status={enrollment.status} />
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <UserRound className="h-3.5 w-3.5" />
                    {enrollment.batch.instructor?.fullName ?? 'Instructor to be assigned'}
                  </p>
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {dateLabel(enrollment.batch.startDate)} – {dateLabel(enrollment.batch.endDate)}
                  </p>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Weekly schedule</p>
                  {enrollment.batch.schedules.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">Schedule not published yet.</p>
                  ) : (
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {enrollment.batch.schedules.map((schedule) => (
                        <li key={`${schedule.dayOfWeek}-${schedule.startTime}`}>
                          {weekdayLabel(schedule.dayOfWeek)} · {schedule.startTime}–{schedule.endTime}
                          {schedule.room ? ` · ${schedule.room}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-muted-foreground">Attendance</p>
                    <p className="text-base font-semibold">
                      {enrollment.attendance ? percent(enrollment.attendance.percentage) : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-muted-foreground">Outstanding</p>
                    <p className="text-base font-semibold">
                      {money(enrollment.fees.outstandingMinor, enrollment.currency)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/student/attendance">Attendance history</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/student/fees">Fee details</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
