'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  FileBadge,
  GraduationCap,
  Receipt,
  Users,
  Wallet,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { dateLabel, dateTimeLabel, money } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

interface AdminDashboard {
  students: { total: number; active: number; activeEnrollments: number };
  academics: { activeCourses: number; activeBatches: number; certificatesIssued: number };
  attendanceToday: { present: number; late: number; absent: number; excused: number };
  fees: {
    collectedThisMonthMinor: number;
    outstandingMinor: number;
    overdueMinor: number;
    overdueInvoices: number;
  };
  admissionsThisMonth: number;
  upcomingSessions: Array<{
    id: string;
    startsAt: string;
    status: string;
    topic: string | null;
    batch: { code: string; name: string; course: { title: string } };
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    actor: { fullName: string } | null;
  }>;
}

export default function AdminDashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: async () => {
      const result = await apiFetch<{ data: AdminDashboard }>('/dashboards/admin');
      return result.data;
    },
  });

  if (error) {
    return <ErrorState message="The dashboard could not be loaded." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Institute overview"
        description="Live operational metrics from the institute database."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/reports">
              Open reports <ArrowRight className="h-4 w-4" />
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
              label="Students"
              value={data.students.active}
              hint={`${data.students.total} total · ${data.students.activeEnrollments} active enrollments`}
              icon={<Users className="h-5 w-5" />}
            />
            <MetricCard
              label="Active batches"
              value={data.academics.activeBatches}
              hint={`${data.academics.activeCourses} active courses`}
              icon={<GraduationCap className="h-5 w-5" />}
              tone="success"
            />
            <MetricCard
              label="Collected this month"
              value={money(data.fees.collectedThisMonthMinor)}
              hint={`${data.admissionsThisMonth} admissions this month`}
              icon={<Wallet className="h-5 w-5" />}
            />
            <MetricCard
              label="Outstanding dues"
              value={money(data.fees.outstandingMinor)}
              hint={`${money(data.fees.overdueMinor)} overdue · ${data.fees.overdueInvoices} invoices`}
              icon={<Receipt className="h-5 w-5" />}
              tone={data.fees.overdueMinor > 0 ? 'warning' : 'default'}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardCheck className="h-4 w-4 text-primary" /> Attendance today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <Skeleton className="h-24" />
            ) : data.attendanceToday.present +
                data.attendanceToday.late +
                data.attendanceToday.absent +
                data.attendanceToday.excused ===
              0 ? (
              <p className="text-sm text-muted-foreground">No attendance marked today yet.</p>
            ) : (
              <div className="space-y-3">
                {(
                  [
                    ['Present', data.attendanceToday.present, 'bg-[hsl(152_60%_40%)]'],
                    ['Late', data.attendanceToday.late, 'bg-[hsl(38_92%_50%)]'],
                    ['Absent', data.attendanceToday.absent, 'bg-[hsl(0_70%_55%)]'],
                    ['Excused', data.attendanceToday.excused, 'bg-[hsl(214_80%_60%)]'],
                  ] as const
                ).map(([label, count, color]) => {
                  const total =
                    data.attendanceToday.present +
                    data.attendanceToday.late +
                    data.attendanceToday.absent +
                    data.attendanceToday.excused;
                  const width = total === 0 ? 0 : Math.round((count / total) * 100);
                  return (
                    <div key={label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 text-primary" /> Upcoming sessions
            </CardTitle>
            <Link href="/admin/attendance" className="text-xs text-primary hover:underline">
              All sessions
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading || !data ? (
              <Skeleton className="h-24" />
            ) : data.upcomingSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions scheduled in the next week.</p>
            ) : (
              data.upcomingSessions.slice(0, 4).map((session) => (
                <Link
                  key={session.id}
                  href={`/admin/attendance/sessions/${session.id}`}
                  className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{session.batch.course.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.batch.code} · {dateTimeLabel(session.startsAt)}
                      </p>
                    </div>
                    <StatusBadge status={session.status} />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileBadge className="h-4 w-4 text-primary" /> Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {isLoading || !data ? (
              <Skeleton className="h-24" />
            ) : data.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recorded activity yet.</p>
            ) : (
              data.recentActivity.slice(0, 5).map((entry) => (
                <div key={entry.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.action.replace(/_/g, ' ').toLowerCase()}</p>
                    <p className="text-muted-foreground">
                      {entry.actor?.fullName ?? 'System'} · {dateLabel(entry.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <Link href="/admin/audit-logs" className="inline-flex items-center gap-1 pt-1 text-xs text-primary hover:underline">
              View audit log <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/admin/students/new', label: 'Admit a student', icon: Users, description: 'Create the student record and portal account.' },
          { href: '/admin/attendance/scan', label: 'Scan attendance', icon: ClipboardCheck, description: 'Open a session and scan student QR codes.' },
          { href: '/admin/fees/payments', label: 'Collect a payment', icon: Receipt, description: 'Post a payment and issue a receipt.' },
          { href: '/admin/certificates', label: 'Issue certificates', icon: FileBadge, description: 'Check eligibility and generate PDFs.' },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-primary/40 hover:bg-primary-soft/30"
          >
            <action.icon className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm font-medium">{action.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-primary" /> Programme snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {isLoading || !data ? (
            <Skeleton className="h-10" />
          ) : (
            <p>
              {data.academics.activeCourses} active programmes across {data.academics.activeBatches} batches ·{' '}
              {data.academics.certificatesIssued} certificates issued to date.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
