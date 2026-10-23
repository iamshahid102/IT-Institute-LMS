'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  Bell,
  CalendarClock,
  ClipboardCheck,
  FileBadge,
  QrCode,
  Receipt,
  Wallet,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { dateLabel, dateTimeLabel, money, percent, weekdayLabel } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';

interface StudentOverview {
  student: { fullName: string; studentNumber: string; status: string };
  attendance: { percentage: number; present: number; absent: number; late: number; excused: number; denominator: number };
  fees: {
    billedMinor: number;
    paidMinor: number;
    outstandingMinor: number;
    overdueMinor: number;
    invoiceCount: number;
  };
  latestPayment: {
    paymentNumber: string;
    amountMinor: number;
    receivedAt: string;
    method: string;
    invoice: { invoiceNumber: string };
  } | null;
  issuedCertificates: number;
  unreadNotifications: number;
  announcements: Array<{ id: string; title: string; publishedAt: string | null }>;
  enrollments: Array<{
    id: string;
    batchCode: string;
    batchName: string;
    courseTitle: string;
    schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string; room: string | null }>;
    nextSession: { id: string; startsAt: string; status: string; topic: string | null } | null;
    attendance: { percentage: number } | null;
  }>;
}

export default function StudentDashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'overview'],
    queryFn: async () => {
      const result = await apiFetch<{ data: StudentOverview }>('/me/overview');
      return result.data;
    },
  });

  if (error) {
    return <ErrorState message="Your dashboard could not be loaded." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={isLoading || !data ? 'Welcome back' : `Welcome back, ${data.student.fullName.split(' ')[0]}`}
        description={
          data ? `Student ${data.student.studentNumber} · ${data.student.status.toLowerCase()} record` : 'Your learning overview'
        }
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/student/attendance">
              <QrCode className="h-4 w-4" /> Attendance QR
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !data ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)
        ) : (
          <>
            <MetricCard
              label="Attendance"
              value={percent(data.attendance.percentage)}
              hint={`${data.attendance.present} present · ${data.attendance.late} late · ${data.attendance.absent} absent`}
              icon={<ClipboardCheck className="h-5 w-5" />}
              tone={data.attendance.percentage >= 75 ? 'success' : 'warning'}
            />
            <MetricCard
              label="Outstanding fees"
              value={money(data.fees.outstandingMinor)}
              hint={`${money(data.fees.paidMinor)} paid of ${money(data.fees.billedMinor)}`}
              icon={<Wallet className="h-5 w-5" />}
              tone={data.fees.overdueMinor > 0 ? 'danger' : 'default'}
            />
            <MetricCard
              label="Certificates"
              value={data.issuedCertificates}
              hint="Issued certificates available to download"
              icon={<FileBadge className="h-5 w-5" />}
              tone="success"
            />
            <MetricCard
              label="Notifications"
              value={data.unreadNotifications}
              hint="Unread updates"
              icon={<Bell className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="h-4 w-4 text-primary" /> Current studies
            </CardTitle>
            <Link href="/student/courses" className="text-xs text-primary hover:underline">
              All courses
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading || !data ? (
              <Skeleton className="h-28" />
            ) : data.enrollments.length === 0 ? (
              <EmptyState
                title="No active enrollment yet"
                description="Once the front desk enrolls you in a batch, your timetable, attendance and fees will appear here."
                icon={<BookOpen className="h-5 w-5" />}
              />
            ) : (
              data.enrollments.map((enrollment) => (
                <div key={enrollment.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{enrollment.courseTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {enrollment.batchName} · {enrollment.batchCode}
                      </p>
                    </div>
                    {enrollment.attendance ? (
                      <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-accent-foreground">
                        {percent(enrollment.attendance.percentage)} attendance
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>
                      <p className="font-medium text-foreground">Weekly schedule</p>
                      {enrollment.schedules.length === 0 ? (
                        <p>Not published yet.</p>
                      ) : (
                        enrollment.schedules.map((schedule) => (
                          <p key={`${schedule.dayOfWeek}-${schedule.startTime}`}>
                            {weekdayLabel(schedule.dayOfWeek)} · {schedule.startTime}–{schedule.endTime}
                            {schedule.room ? ` · ${schedule.room}` : ''}
                          </p>
                        ))
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Next session</p>
                      {enrollment.nextSession ? (
                        <>
                          <p>{dateTimeLabel(enrollment.nextSession.startsAt)}</p>
                          <StatusBadge status={enrollment.nextSession.status} className="mt-1" />
                        </>
                      ) : (
                        <p>No upcoming session scheduled.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Receipt className="h-4 w-4 text-primary" /> Latest payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || !data ? (
                <Skeleton className="h-16" />
              ) : data.latestPayment ? (
                <div className="space-y-1">
                  <p className="text-lg font-semibold">{money(data.latestPayment.amountMinor)}</p>
                  <p className="text-xs text-muted-foreground">
                    {data.latestPayment.invoice.invoiceNumber} · {dateLabel(data.latestPayment.receivedAt)}
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                    <Link href="/student/fees/receipts">View receipts</Link>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-semibold">Announcements</CardTitle>
              <Link href="/student/announcements" className="text-xs text-primary hover:underline">
                All
              </Link>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {isLoading || !data ? (
                <Skeleton className="h-16" />
              ) : data.announcements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No announcements yet.</p>
              ) : (
                data.announcements.map((announcement) => (
                  <Link
                    key={announcement.id}
                    href="/student/announcements"
                    className="block rounded-lg border p-2.5 text-sm transition-colors hover:bg-muted/40"
                  >
                    <p className="line-clamp-2 font-medium">{announcement.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{dateLabel(announcement.publishedAt)}</p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: '/student/attendance', label: 'Attendance & QR', icon: ClipboardCheck },
          { href: '/student/fees', label: 'Fees & installments', icon: Wallet },
          { href: '/student/certificates', label: 'My certificates', icon: FileBadge },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center justify-between rounded-xl border bg-card p-4 text-sm font-medium shadow-card transition-colors hover:border-primary/40 hover:bg-primary-soft/30"
          >
            <span className="flex items-center gap-2">
              <action.icon className="h-4 w-4 text-primary" />
              {action.label}
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" /> Times are shown in the institute time zone (Asia/Karachi).
      </p>
    </div>
  );
}
