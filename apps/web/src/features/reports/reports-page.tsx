'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { dateLabel, localDateInput, money } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorState, EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';

interface AdmissionsReport {
  from: string;
  to: string;
  total: number;
  byStatus: Array<{ status: string; count: number }>;
  rows: Array<{
    studentNumber: string;
    fullName: string;
    phone: string;
    admissionDate: string;
    status: string;
    courses: string;
  }>;
}

interface CollectionsReport {
  from: string;
  to: string;
  grossMinor: number;
  reversedMinor: number;
  netMinor: number;
  paymentCount: number;
  byMethod: Array<{ method: string; grossMinor: number; reversedMinor: number; count: number }>;
  payments: Array<{
    id: string;
    paymentNumber: string;
    receivedAt: string;
    method: string;
    amountMinor: number;
    reversedMinor: number;
    invoiceNumber: string;
    batchCode: string;
  }>;
}

interface OutstandingReport {
  rows: Array<{
    id: string;
    invoiceNumber: string;
    dueAt: string;
    totalMinor: number;
    paidMinor: number;
    outstandingMinor: number;
    overdue: boolean;
    student: { studentNumber: string; fullName: string; phone: string };
    batch: { code: string };
  }>;
  totals: { outstandingMinor: number; overdueMinor: number; invoiceCount: number };
}

interface CompletionsReport {
  from: string;
  to: string;
  total: number;
  rows: Array<{
    studentNumber: string;
    studentName: string;
    batchCode: string;
    courseTitle: string;
    completedAt: string;
    certificateNumber: string | null;
  }>;
}

function exportUrl(path: string, params: Record<string, string | undefined>): string {
  return `/api/v1${path}${qs({ ...params, format: 'csv' })}`;
}

export function ReportsPage({ mode = 'admin' }: { mode?: 'admin' | 'front-desk' }) {
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const [from, setFrom] = React.useState(localDateInput(new Date(Date.now() - 30 * 864e5)));
  const [to, setTo] = React.useState(localDateInput());
  const [tab, setTab] = React.useState('admissions');

  const admissions = useQuery({
    queryKey: ['report', 'admissions', from, to],
    queryFn: async () =>
      (await apiFetch<{ data: AdmissionsReport }>(`/reports/admissions${qs({ from, to })}`)).data,
    enabled: tab === 'admissions',
  });

  const collections = useQuery({
    queryKey: ['report', 'collections', from, to],
    queryFn: async () =>
      (await apiFetch<{ data: CollectionsReport }>(`/reports/fees/collections${qs({ from, to })}`)).data,
    enabled: tab === 'collections',
  });

  const outstanding = useQuery({
    queryKey: ['report', 'outstanding'],
    queryFn: async () => (await apiFetch<{ data: OutstandingReport }>('/reports/fees/outstanding')).data,
    enabled: tab === 'outstanding',
  });

  const completions = useQuery({
    queryKey: ['report', 'completions', from, to],
    queryFn: async () =>
      (await apiFetch<{ data: CompletionsReport }>(`/reports/completions${qs({ from, to })}`)).data,
    enabled: tab === 'completions',
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description="Operational and financial reports with authorized CSV exports."
        backHref={base}
        backLabel="Dashboard"
      />

      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-card sm:flex-row sm:items-end">
        <div className="space-y-1.5">
          <label htmlFor="report-from" className="block text-xs font-medium text-muted-foreground">
            From
          </label>
          <Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="report-to" className="block text-xs font-medium text-muted-foreground">
            To
          </label>
          <Input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground sm:ml-auto">Date-bounded reports use the selected range.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="admissions">Admissions</TabsTrigger>
          <TabsTrigger value="collections">Fee collections</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
          <TabsTrigger value="completions">Completions</TabsTrigger>
        </TabsList>

        <TabsContent value="admissions">
          {admissions.error ? (
            <ErrorState message="The admissions report could not be loaded." onRetry={() => void admissions.refetch()} />
          ) : admissions.isLoading || !admissions.data ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Admissions · {admissions.data.total}</CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <a href={exportUrl('/reports/admissions', { from, to })}>
                    <Download className="h-3.5 w-3.5" /> Export CSV
                  </a>
                </Button>
              </CardHeader>
              {admissions.data.rows.length === 0 ? (
                <CardContent>
                  <EmptyState title="No admissions in this range" description="Adjust the date range to see admissions." />
                </CardContent>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">Phone</th>
                        <th className="px-3 py-2 font-medium">Admitted</th>
                        <th className="px-3 py-2 font-medium">Courses</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {admissions.data.rows.map((row) => (
                        <tr key={row.studentNumber}>
                          <td className="px-4 py-2">
                            <p className="font-medium">{row.fullName}</p>
                            <p className="font-mono text-xs text-muted-foreground">{row.studentNumber}</p>
                          </td>
                          <td className="px-3 py-2">{row.phone}</td>
                          <td className="px-3 py-2">{dateLabel(row.admissionDate)}</td>
                          <td className="px-3 py-2 text-xs">{row.courses || '—'}</td>
                          <td className="px-4 py-2">
                            <StatusBadge status={row.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="collections">
          {collections.error ? (
            <ErrorState message="The collections report could not be loaded." onRetry={() => void collections.refetch()} />
          ) : collections.isLoading || !collections.data ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: 'Gross collected', value: money(collections.data.grossMinor) },
                  { label: 'Reversed', value: money(collections.data.reversedMinor) },
                  { label: 'Net collected', value: money(collections.data.netMinor) },
                  { label: 'Payments', value: String(collections.data.paymentCount) },
                ].map((metric) => (
                  <Card key={metric.label}>
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">{metric.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Payments in range</CardTitle>
                  <Button variant="outline" size="sm" asChild>
                    <a href={exportUrl('/reports/fees/collections', { from, to })}>
                      <Download className="h-3.5 w-3.5" /> Export CSV
                    </a>
                  </Button>
                </CardHeader>
                {collections.data.payments.length === 0 ? (
                  <CardContent>
                    <EmptyState title="No payments in this range" description="Adjust the date range to see collections." />
                  </CardContent>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 font-medium">Receipt</th>
                          <th className="px-3 py-2 font-medium">Invoice</th>
                          <th className="px-3 py-2 font-medium">Batch</th>
                          <th className="px-3 py-2 font-medium">Method</th>
                          <th className="px-3 py-2 font-medium">Received</th>
                          <th className="px-4 py-2 text-right font-medium">Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {collections.data.payments.map((payment) => (
                          <tr key={payment.id}>
                            <td className="px-4 py-2 font-mono text-xs">{payment.paymentNumber}</td>
                            <td className="px-3 py-2 font-mono text-xs">{payment.invoiceNumber}</td>
                            <td className="px-3 py-2 font-mono text-xs">{payment.batchCode}</td>
                            <td className="px-3 py-2 capitalize">{payment.method.replace(/_/g, ' ').toLowerCase()}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{dateLabel(payment.receivedAt)}</td>
                            <td className="px-4 py-2 text-right tabular-nums">
                              {money(payment.amountMinor - payment.reversedMinor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="outstanding">
          {outstanding.error ? (
            <ErrorState message="The outstanding report could not be loaded." onRetry={() => void outstanding.refetch()} />
          ) : outstanding.isLoading || !outstanding.data ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                  Outstanding · {money(outstanding.data.totals.outstandingMinor)} across{' '}
                  {outstanding.data.totals.invoiceCount} invoices
                </CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <a href={exportUrl('/reports/fees/outstanding', {})}>
                    <Download className="h-3.5 w-3.5" /> Export CSV
                  </a>
                </Button>
              </CardHeader>
              {outstanding.data.rows.length === 0 ? (
                <CardContent>
                  <EmptyState title="Nothing outstanding" description="All invoices are settled." />
                </CardContent>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">Invoice</th>
                        <th className="px-3 py-2 font-medium">Due</th>
                        <th className="px-3 py-2 text-right font-medium">Outstanding</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {outstanding.data.rows.map((row) => (
                        <tr key={row.id}>
                          <td className="px-4 py-2">
                            <p className="font-medium">{row.student.fullName}</p>
                            <p className="font-mono text-xs text-muted-foreground">{row.student.studentNumber}</p>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{row.invoiceNumber}</td>
                          <td className="px-3 py-2 text-xs">{dateLabel(row.dueAt)}</td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">{money(row.outstandingMinor)}</td>
                          <td className="px-4 py-2">
                            <StatusBadge status="ISSUED" />
                            <p className={row.overdue ? 'text-xs font-medium text-destructive' : 'text-xs text-muted-foreground'}>
                              {row.overdue ? 'Overdue' : 'Within terms'}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completions">
          {completions.error ? (
            <ErrorState message="The completions report could not be loaded." onRetry={() => void completions.refetch()} />
          ) : completions.isLoading || !completions.data ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Completions · {completions.data.total}</CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <a href={exportUrl('/reports/completions', { from, to })}>
                    <Download className="h-3.5 w-3.5" /> Export CSV
                  </a>
                </Button>
              </CardHeader>
              {completions.data.rows.length === 0 ? (
                <CardContent>
                  <EmptyState title="No completions in this range" description="Adjust the date range to see completions." />
                </CardContent>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">Course</th>
                        <th className="px-3 py-2 font-medium">Completed</th>
                        <th className="px-4 py-2 font-medium">Certificate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {completions.data.rows.map((row) => (
                        <tr key={`${row.studentNumber}-${row.batchCode}`}>
                          <td className="px-4 py-2">
                            <p className="font-medium">{row.studentName}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {row.studentNumber} · {row.batchCode}
                            </p>
                          </td>
                          <td className="px-3 py-2">{row.courseTitle}</td>
                          <td className="px-3 py-2 text-xs">{dateLabel(row.completedAt)}</td>
                          <td className="px-4 py-2 font-mono text-xs">{row.certificateNumber ?? 'Not issued'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
