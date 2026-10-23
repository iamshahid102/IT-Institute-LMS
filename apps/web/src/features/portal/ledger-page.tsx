'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { dateLabel, money } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';

interface Entry {
  type: string;
  date: string;
  reference: string;
  description: string;
  debitMinor: number;
  creditMinor: number;
}

export function PortalLedgerPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'fees'],
    queryFn: async () =>
      (await apiFetch<{ data: { entries: Entry[]; summary: { billedMinor: number; paidMinor: number; outstandingMinor: number } } }>(
        '/me/fees',
      )).data,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fee ledger"
        description="Every invoice, payment and reversal in date order."
        backHref="/student/fees"
        backLabel="Fees"
      />

      {error ? (
        <ErrorState message="Your ledger could not be loaded." onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <LoadingSkeleton rows={5} />
      ) : data.entries.length === 0 ? (
        <EmptyState title="No ledger entries" description="Your fee activity will appear once an invoice is issued." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Reference</th>
                  <th className="px-3 py-3 font-medium">Description</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 text-right font-medium">Debit</th>
                  <th className="px-4 py-3 text-right font-medium">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.entries.map((entry, index) => (
                  <tr key={`${entry.reference}-${index}`}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{dateLabel(entry.date)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{entry.reference}</td>
                    <td className="px-3 py-2.5">{entry.description}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={entry.type} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {entry.debitMinor > 0 ? money(entry.debitMinor) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {entry.creditMinor > 0 ? money(entry.creditMinor) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-right text-xs uppercase tracking-wide text-muted-foreground">
                    Outstanding
                  </td>
                  <td colSpan={2} className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {money(data.summary.outstandingMinor)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
