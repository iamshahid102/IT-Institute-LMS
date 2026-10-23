'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  Receipt,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { dateLabel, dateTimeLabel, money, timeLabel } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';

interface FrontDeskDashboard {
  todaySessions: Array<{
    id: string;
    startsAt: string;
    status: string;
    topic: string | null;
    batch: { code: string; name: string; course: { title: string } };
    _count: { attendance: number };
  }>;
  recentAdmissions: Array<{
    id: string;
    studentNumber: string;
    fullName: string;
    admissionDate: string;
    status: string;
  }>;
  recentPayments: Array<{
    id: string;
    paymentNumber: string;
    amountMinor: number;
    receivedAt: string;
    method: string;
    studentName: string;
    invoiceNumber: string;
  }>;
  outstanding: { outstandingMinor: number; overdueMinor: number; invoiceCount: number };
  collectedTodayMinor: number;
}

export default function FrontDeskDashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'front-desk'],
    queryFn: async () => {
      const result = await apiFetch<{ data: FrontDeskDashboard }>('/dashboards/front-desk');
      return result.data;
    },
  });

  if (error) {
    return <ErrorState message="The dashboard could not be loaded." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Front desk"
        description="Today's sessions, admissions and collections."
        actions={
          <Button asChild size="sm">
            <Link href="/front-desk/students/new">
              <UserPlus className="h-4 w-4" /> New admission
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
              label="Collected today"
              value={money(data.collectedTodayMinor)}
              hint="Payments posted today"
              icon={<Wallet className="h-5 w-5" />}
              tone="success"
            />
            <MetricCard
              label="Outstanding dues"
              value={money(data.outstanding.outstandingMinor)}
              hint={`${money(data.outstanding.overdueMinor)} overdue`}
              icon={<Receipt className="h-5 w-5" />}
              tone={data.outstanding.overdueMinor > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="Sessions today"
              value={data.todaySessions.length}
              hint={`${data.todaySessions.filter((session) => session.status === 'OPEN').length} open for marking`}
              icon={<ClipboardCheck className="h-5 w-5" />}
            />
            <MetricCard
              label="Students"
              value={data.recentAdmissions.length > 0 ? 'Recent' : '—'}
              hint="Use the students screen to search all records"
              icon={<Users className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 text-primary" /> Today&apos;s sessions
            </CardTitle>
            <Link href="/front-desk/attendance" className="text-xs text-primary hover:underline">
              All sessions
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {isLoading || !data ? (
              <Skeleton className="h-24" />
            ) : data.todaySessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions are scheduled for today.</p>
            ) : (
              data.todaySessions.map((session) => (
                <div key={session.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{session.batch.course.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {session.batch.code} · {timeLabel(session.startsAt)} · {session._count.attendance} marked
                      </p>
                    </div>
                    <StatusBadge status={session.status} />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/front-desk/attendance/sessions/${session.id}`}>
                        {session.status === 'OPEN' ? 'Mark attendance' : 'View roster'}
                      </Link>
                    </Button>
                    {session.status === 'OPEN' ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/front-desk/attendance/scan?sessionId=${session.id}`}>Scan QR</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Receipt className="h-4 w-4 text-primary" /> Recent receipts
            </CardTitle>
            <Link href="/front-desk/fees/receipts" className="text-xs text-primary hover:underline">
              All receipts
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {isLoading || !data ? (
              <Skeleton className="h-24" />
            ) : data.recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              data.recentPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{payment.studentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {payment.invoiceNumber} · {dateLabel(payment.receivedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{money(payment.amountMinor)}</p>
                    <p className="text-[11px] text-muted-foreground">{payment.method.replace('_', ' ')}</p>
                  </div>
                </div>
              ))
            )}
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href="/front-desk/fees/collect">
                <CreditCard className="h-4 w-4" /> Collect a payment
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold">Recent admissions</CardTitle>
          <Link href="/front-desk/students" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            All students <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading || !data ? (
            <Skeleton className="h-16" />
          ) : data.recentAdmissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admissions recorded yet.</p>
          ) : (
            data.recentAdmissions.map((student) => (
              <Link
                key={student.id}
                href={`/front-desk/students/${student.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
              >
                <div>
                  <p className="text-sm font-medium">{student.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {student.studentNumber} · admitted {dateLabel(student.admissionDate)}
                  </p>
                </div>
                <StatusBadge status={student.status} />
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
