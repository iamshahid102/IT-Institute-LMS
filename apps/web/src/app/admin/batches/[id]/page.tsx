'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardCheck, Pencil, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { dateLabel, dateTimeLabel, money, weekdayLabel } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { BatchDialog, type BatchRecord } from '@/features/academics/batch-dialog';

interface BatchDetailData extends BatchRecord {
  enrollments: Array<{
    id: string;
    status: string;
    joinedAt: string;
    agreedFeeMinor: number;
    student: { id: string; studentNumber: string; fullName: string; phone: string; status: string };
  }>;
  sessions: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    topic: string | null;
    _count: { attendance: number };
  }>;
}

export default function BatchDetailPage() {
  const params = useParams<{ id: string }>();
  const [editOpen, setEditOpen] = React.useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['batch', params.id],
    queryFn: async () => {
      const result = await apiFetch<{ data: BatchDetailData }>(`/batches/${params.id}`);
      return result.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-80" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState message="This batch could not be loaded." onRetry={() => void refetch()} />;
  }

  const activeEnrollments = data.enrollments.filter((enrollment) => enrollment.status === 'ACTIVE').length;

  return (
    <div className="space-y-4">
      <PageHeader
        title={data.name}
        description={`${data.course.title} · ${data.code}`}
        backHref="/admin/batches"
        actions={
          <>
            <StatusBadge status={data.status} />
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit batch
            </Button>
            <Button size="sm" asChild>
              <Link href={`/admin/attendance?batchId=${data.id}`}>
                <ClipboardCheck className="h-4 w-4" /> Sessions
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Enrolled" value={`${data.enrollments.length}/${data.capacity}`} hint={`${activeEnrollments} active`} icon={<Users className="h-5 w-5" />} />
        <MetricCard label="Schedule slots" value={data.schedules.length} hint="Per week" icon={<CalendarDays className="h-5 w-5" />} />
        <MetricCard label="Sessions" value={data.sessions.length} hint="Recent and upcoming" icon={<ClipboardCheck className="h-5 w-5" />} />
        <MetricCard
          label="Instructor"
          value={data.instructor?.fullName ?? 'Unassigned'}
          hint={data.instructor ? 'Assigned' : 'Assign an instructor'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-primary" /> Roster
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.enrollments.length === 0 ? (
              <EmptyState title="No students enrolled" description="Enroll students from a student record or the enrollments screen." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Student</th>
                      <th className="px-3 py-2 font-medium">Joined</th>
                      <th className="px-3 py-2 text-right font-medium">Agreed fee</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.enrollments.map((enrollment) => (
                      <tr key={enrollment.id} className="border-t">
                        <td className="px-3 py-3">
                          <Link href={`/admin/students/${enrollment.student.id}`} className="font-medium hover:underline">
                            {enrollment.student.fullName}
                          </Link>
                          <p className="font-mono text-xs text-muted-foreground">{enrollment.student.studentNumber}</p>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{dateLabel(enrollment.joinedAt)}</td>
                        <td className="px-3 py-3 text-right">{money(enrollment.agreedFeeMinor)}</td>
                        <td className="px-3 py-3">
                          <StatusBadge status={enrollment.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="h-4 w-4 text-primary" /> Weekly schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.schedules.length === 0 ? (
                <p className="text-muted-foreground">No schedule slots defined.</p>
              ) : (
                data.schedules.map((schedule) => (
                  <div key={`${schedule.dayOfWeek}-${schedule.startTime}`} className="flex items-center justify-between rounded-lg border p-2.5">
                    <div>
                      <p className="font-medium">{weekdayLabel(schedule.dayOfWeek)}</p>
                      <p className="text-xs text-muted-foreground">
                        {schedule.startTime}–{schedule.endTime}
                        {schedule.room ? ` · ${schedule.room}` : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div className="border-t pt-2 text-xs text-muted-foreground">
                {dateLabel(data.startDate)} – {dateLabel(data.endDate)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Recent sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sessions created yet.</p>
              ) : (
                data.sessions.slice(0, 6).map((session) => (
                  <Link
                    key={session.id}
                    href={`/admin/attendance/sessions/${session.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm hover:bg-muted/40"
                  >
                    <div>
                      <p className="font-medium">{session.topic ?? 'Class session'}</p>
                      <p className="text-xs text-muted-foreground">
                        {dateTimeLabel(session.startsAt)} · {session._count.attendance} marked
                      </p>
                    </div>
                    <StatusBadge status={session.status} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <BatchDialog open={editOpen} onOpenChange={setEditOpen} batch={data} />
    </div>
  );
}
