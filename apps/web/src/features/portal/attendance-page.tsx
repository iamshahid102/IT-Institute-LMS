'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { QrCode, RefreshCw } from 'lucide-react';
import { apiFetch, formatApiError } from '@/lib/api';
import { dateTimeLabel, percent } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';

interface Summary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  eligibleSessions: number;
  percentage: number;
}

interface AttendanceData {
  summaries: Array<{ enrollmentId: string; batchCode: string; batchName: string; courseTitle: string; summary: Summary }>;
  totals: Summary & { countedPresent: number; denominator: number };
  thresholdPercent: number;
  policy: { lateCountsAsPresent: boolean; excusedCountsInDenominator: boolean };
  records: Array<{
    id: string;
    status: string;
    method: string;
    markedAt: string;
    remarks: string | null;
    correctionReason: string | null;
    session: { id: string; startsAt: string; status: string; topic: string | null; batch: { code: string } };
  }>;
}

export function PortalAttendancePage() {
  const [qr, setQr] = React.useState<{ dataUrl: string; expiresAt: string } | null>(null);
  const [qrError, setQrError] = React.useState<string | null>(null);
  const [qrLoading, setQrLoading] = React.useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'attendance'],
    queryFn: async () => (await apiFetch<{ data: AttendanceData }>('/me/attendance')).data,
  });

  const generateQr = React.useCallback(async () => {
    setQrLoading(true);
    setQrError(null);
    try {
      const result = await apiFetch<{ data: { token: string; expiresAt: string } }>('/me/attendance/qr', {
        method: 'POST',
      });
      const dataUrl = await QRCode.toDataURL(result.data.token, { width: 320, margin: 2 });
      setQr({ dataUrl, expiresAt: result.data.expiresAt });
      window.setTimeout(() => setQr(null), Math.max(0, new Date(result.data.expiresAt).getTime() - Date.now()));
    } catch (generateError) {
      setQrError(formatApiError(generateError));
    } finally {
      setQrLoading(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Attendance"
        description="Only finalized sessions count. Ask staff to scan your code while the session is open."
        backHref="/student"
        backLabel="Dashboard"
      />

      {error ? (
        <ErrorState message="Your attendance could not be loaded." onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Overall attendance"
              value={percent(data.totals.percentage)}
              hint={`Required ${data.thresholdPercent}%`}
              tone={data.totals.percentage >= data.thresholdPercent ? 'success' : 'warning'}
            />
            <MetricCard label="Present" value={data.totals.present} hint={`${data.totals.late} late`} />
            <MetricCard label="Absent" value={data.totals.absent} hint={`${data.totals.excused} excused`} />
            <MetricCard label="Sessions counted" value={data.totals.eligibleSessions} hint="Finalized sessions in your enrollment" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <QrCode className="h-4 w-4 text-primary" /> Attendance code
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {qr ? (
                  <>
                    <div className="flex justify-center rounded-xl border bg-white p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qr.dataUrl} alt="Your attendance QR code" className="h-56 w-56" />
                    </div>
                    <p className="text-center text-xs text-muted-foreground">
                      Valid until {new Date(qr.expiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </>
                ) : (
                  <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed text-center">
                    <QrCode className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 max-w-[220px] text-xs text-muted-foreground">
                      Generate a short-lived code and show it to staff at the class.
                    </p>
                  </div>
                )}
                {qrError ? <p className="text-sm text-destructive">{qrError}</p> : null}
                <Button className="w-full" onClick={() => void generateQr()} disabled={qrLoading}>
                  <RefreshCw className="h-4 w-4" /> {qrLoading ? 'Generating…' : qr ? 'New code' : 'Generate code'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  If you cannot display the code, staff can mark you by student number.
                </p>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Attendance by course</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.summaries.length === 0 ? (
                  <div className="p-4">
                    <EmptyState title="No enrolled courses" description="Attendance appears once you are enrolled in a batch." />
                  </div>
                ) : (
                  <div className="divide-y">
                    {data.summaries.map((summary) => (
                      <div key={summary.enrollmentId} className="flex flex-wrap items-center justify-between gap-2 p-4">
                        <div>
                          <p className="text-sm font-medium">{summary.courseTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {summary.batchName} · {summary.batchCode}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold tabular-nums">{percent(summary.summary.percentage)}</p>
                          <p className="text-xs text-muted-foreground">
                            {summary.summary.present} present · {summary.summary.late} late · {summary.summary.absent} absent
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attendance history</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.records.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No attendance yet" description="Records appear after your first finalized session." />
                </div>
              ) : (
                <div className="divide-y">
                  {data.records.map((record) => (
                    <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                      <div>
                        <p className="text-sm font-medium">{record.session.topic ?? 'Class session'}</p>
                        <p className="text-xs text-muted-foreground">
                          {dateTimeLabel(record.session.startsAt)} · {record.session.batch.code} ·{' '}
                          {record.method === 'QR' ? 'QR scan' : 'Manual'}
                        </p>
                        {record.correctionReason ? (
                          <p className="text-xs text-muted-foreground">Corrected: {record.correctionReason}</p>
                        ) : null}
                      </div>
                      <StatusBadge status={record.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Policy: late arrivals {data.policy.lateCountsAsPresent ? 'count' : 'do not count'} as present; excused absences{' '}
            {data.policy.excusedCountsInDenominator ? 'count' : 'do not count'} in the denominator.
          </p>
        </>
      )}
    </div>
  );
}
