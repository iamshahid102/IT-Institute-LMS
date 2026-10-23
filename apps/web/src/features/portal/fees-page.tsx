'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Receipt, Wallet } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { dateLabel, money } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';

interface LedgerEntry {
  type: string;
  date: string;
  reference: string;
  description: string;
  debitMinor: number;
  creditMinor: number;
  invoiceId: string;
  paymentId?: string;
}

interface FeesData {
  summary: {
    billedMinor: number;
    paidMinor: number;
    outstandingMinor: number;
    overdueMinor: number;
    invoiceCount: number;
  };
  entries: LedgerEntry[];
}

export function PortalFeesPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'fees'],
    queryFn: async () => (await apiFetch<{ data: FeesData }>('/me/fees')).data,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fees"
        description="Your fee summary and most recent ledger activity."
        backHref="/student"
        backLabel="Dashboard"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/student/fees/receipts">
              <Receipt className="h-4 w-4" /> Receipts
            </Link>
          </Button>
        }
      />

      {error ? (
        <ErrorState message="Your fee information could not be loaded." onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total billed" value={money(data.summary.billedMinor)} hint={`${data.summary.invoiceCount} invoices`} />
            <MetricCard label="Paid" value={money(data.summary.paidMinor)} tone="success" />
            <MetricCard
              label="Outstanding"
              value={money(data.summary.outstandingMinor)}
              tone={data.summary.outstandingMinor > 0 ? 'danger' : 'default'}
              icon={<Wallet className="h-5 w-5" />}
            />
            <MetricCard
              label="Overdue"
              value={money(data.summary.overdueMinor)}
              tone={data.summary.overdueMinor > 0 ? 'danger' : 'default'}
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Recent activity</CardTitle>
              <Link href="/student/fees/ledger" className="text-xs text-primary hover:underline">
                Full ledger
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {data.entries.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No fee activity" description="Invoices and payments will appear here." />
                </div>
              ) : (
                <div className="divide-y">
                  {data.entries.slice(-8).reverse().map((entry, index) => (
                    <div key={`${entry.reference}-${index}`} className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{entry.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {dateLabel(entry.date)} · {entry.reference}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={
                            entry.type === 'PAYMENT'
                              ? 'text-sm font-medium tabular-nums text-emerald-600'
                              : entry.type === 'REVERSAL'
                                ? 'text-sm font-medium tabular-nums text-destructive'
                                : 'text-sm font-medium tabular-nums'
                          }
                        >
                          {entry.type === 'PAYMENT'
                            ? `− ${money(entry.creditMinor)}`
                            : entry.type === 'REVERSAL'
                              ? `+ ${money(entry.debitMinor)}`
                              : `+ ${money(entry.debitMinor)}`}
                        </p>
                        <StatusBadge status={entry.type} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            If a payment looks incorrect, contact the front desk. Posted payments are corrected with an auditable reversal,
            never deleted.
          </p>
        </>
      )}
    </div>
  );
}
