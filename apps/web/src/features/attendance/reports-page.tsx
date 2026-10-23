'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ErrorState, EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';
import { useBatches } from '@/features/shared/options';

interface Summary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  eligibleSessions: number;
  denominator: number;
  percentage: number;
}

interface Row {
  enrollmentId: string;
  student: { id: string; studentNumber: string; fullName: string };
  enrollmentStatus: string;
  summary: Summary;
}

interface ReportResponse {
  batch: { id: string; code: string; name: string; course: { title: string } };
  rows: Row[];
}

export function AttendanceReports({ mode }: { mode: 'admin' | 'front-desk' }) {
  const batches = useBatches();
  const [batchId, setBatchId] = React.useState('');
  const selectedBatchId = batchId || batches.data?.[0]?.id || '';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['attendance', 'report', selectedBatchId],
    queryFn: async () =>
      (await apiFetch<{ data: ReportResponse }>(`/attendance/reports${qs({ batchId: selectedBatchId })}`)).data,
    enabled: Boolean(selectedBatchId),
  });

  const atRisk = data?.rows.filter((row) => row.summary.percentage < 75) ?? [];
  const average =
    data && data.rows.length > 0
      ? Math.round((data.rows.reduce((sum, row) => sum + row.summary.percentage, 0) / data.rows.length) * 10) / 10
      : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Attendance reports"
        description="Attendance percentages use only finalized sessions within each enrollment window."
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-card sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-sm">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="report-batch">
            Batch
          </label>
          <Select value={selectedBatchId} onValueChange={setBatchId}>
            <SelectTrigger id="report-batch">
              <SelectValue placeholder="Select a batch" />
            </SelectTrigger>
            <SelectContent>
              {(batches.data ?? []).map((batch) => (
                <SelectItem key={batch.id} value={batch.id}>
                  {batch.code} · {batch.course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <ErrorState message="The attendance report could not be loaded." onRetry={() => void refetch()} />
      ) : isLoading || batches.isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : !selectedBatchId ? (
        <EmptyState title="No batches yet" description="Create a batch with enrolled students to see attendance." />
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Batch</p>
                <p className="mt-1 font-medium">{data.batch.course.title}</p>
                <p className="font-mono text-xs text-muted-foreground">{data.batch.code}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Average attendance</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{average}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Below 75%</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{atRisk.length}</p>
                <p className="text-xs text-muted-foreground">students at risk</p>
              </CardContent>
            </Card>
          </div>

          {data.rows.length === 0 ? (
            <EmptyState title="No enrolled students" description="This batch has no enrollments to report on." />
          ) : (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base">Student attendance</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Student</th>
                      <th className="px-3 py-2 font-medium tabular-nums">Sessions</th>
                      <th className="px-3 py-2 font-medium tabular-nums">Present</th>
                      <th className="px-3 py-2 font-medium tabular-nums">Late</th>
                      <th className="px-3 py-2 font-medium tabular-nums">Absent</th>
                      <th className="px-3 py-2 font-medium tabular-nums">Excused</th>
                      <th className="px-3 py-2 text-right font-medium tabular-nums">Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.rows.map((row) => (
                      <tr key={row.enrollmentId}>
                        <td className="px-4 py-2">
                          <p className="font-medium">{row.student.fullName}</p>
                          <p className="font-mono text-xs text-muted-foreground">{row.student.studentNumber}</p>
                        </td>
                        <td className="px-3 py-2 tabular-nums">{row.summary.eligibleSessions}</td>
                        <td className="px-3 py-2 tabular-nums">{row.summary.present}</td>
                        <td className="px-3 py-2 tabular-nums">{row.summary.late}</td>
                        <td className="px-3 py-2 tabular-nums">{row.summary.absent}</td>
                        <td className="px-3 py-2 tabular-nums">{row.summary.excused}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="font-medium tabular-nums">{row.summary.percentage}%</span>
                          {row.summary.percentage < 75 && row.summary.denominator > 0 ? (
                            <Badge variant="warning" className="ml-2">
                              At risk
                            </Badge>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
