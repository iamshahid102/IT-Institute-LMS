'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Wallet } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { dateLabel, money } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState, EmptyState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { PaymentDialog, type PayableInvoice } from './payment-dialog';

interface OutstandingRow extends PayableInvoice {
  invoiceNumber: string;
  dueAt: string;
  totalMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  overdue: boolean;
  student: { id: string; studentNumber: string; fullName: string; phone: string };
  batch: { code: string; name: string };
}

interface OutstandingResponse {
  rows: OutstandingRow[];
  totals: { outstandingMinor: number; overdueMinor: number; invoiceCount: number };
}

export function DuesPage({ mode }: { mode: 'admin' | 'front-desk' }) {
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const { can } = useAuth();
  const [paying, setPaying] = React.useState<PayableInvoice | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['outstanding'],
    queryFn: async () =>
      (await apiFetch<{ data: OutstandingResponse }>('/reports/fees/outstanding')).data,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Outstanding dues"
        description="Every unpaid or partially paid invoice, ordered by due date."
        backHref={`${base}/fees`}
        backLabel="Invoices"
        actions={
          <Button variant="outline" onClick={() => window.open('/api/v1/reports/fees/outstanding?format=csv', '_blank')}>
            Export CSV
          </Button>
        }
      />

      {error ? (
        <ErrorState message="Outstanding dues could not be loaded." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Total outstanding"
              value={money(data.totals.outstandingMinor)}
              icon={<Wallet className="h-5 w-5" />}
              hint={`${data.totals.invoiceCount} invoices`}
            />
            <MetricCard
              label="Overdue"
              value={money(data.totals.overdueMinor)}
              icon={<AlertTriangle className="h-5 w-5" />}
              hint="Past the due date"
            />
            <MetricCard
              label="Overdue invoices"
              value={data.rows.filter((row) => row.overdue).length}
              hint={`of ${data.rows.length} unpaid invoices`}
            />
          </div>

          {data.rows.length === 0 ? (
            <EmptyState title="No outstanding dues" description="Every invoice has been settled." />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Student</th>
                      <th className="px-3 py-3 font-medium">Invoice</th>
                      <th className="px-3 py-3 font-medium">Due</th>
                      <th className="px-3 py-3 text-right font-medium">Total</th>
                      <th className="px-3 py-3 text-right font-medium">Outstanding</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3">
                          <Link href={`${base}/students/${row.student.id}`} className="font-medium hover:underline">
                            {row.student.fullName}
                          </Link>
                          <p className="font-mono text-xs text-muted-foreground">
                            {row.student.studentNumber} · {row.batch.code}
                          </p>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">{row.invoiceNumber}</td>
                        <td className="px-3 py-3">
                          <span className={row.overdue ? 'font-medium text-destructive' : ''}>{dateLabel(row.dueAt)}</span>
                          {row.overdue ? <p className="text-xs text-destructive">Overdue</p> : null}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{money(row.totalMinor)}</td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">{money(row.outstandingMinor)}</td>
                        <td className="px-3 py-3">
                          <StatusBadge status={row.paidMinor > 0 ? 'PARTIALLY_PAID' : 'ISSUED'} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" asChild>
                              <Link href={`${base}/fees/${row.id}`}>View</Link>
                            </Button>
                            {can('fee.payment.receive') ? (
                              <Button size="sm" variant="outline" onClick={() => setPaying(row)}>
                                Collect
                              </Button>
                            ) : null}
                          </div>
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

      <PaymentDialog open={Boolean(paying)} onOpenChange={(open) => !open && setPaying(null)} invoice={paying} />
    </div>
  );
}
