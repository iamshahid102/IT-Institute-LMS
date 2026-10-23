'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, downloadFile, formatApiError } from '@/lib/api';
import { dateTimeLabel, money } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';

interface ReceiptRow {
  id: string;
  paymentNumber: string;
  amountMinor: number;
  currency: string;
  method: string;
  status: string;
  reference: string | null;
  receivedAt: string;
  invoice: { id: string; invoiceNumber: string; batchCode: string };
}

export function PortalReceiptsPage() {
  const [page, setPage] = React.useState(1);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'receipts', page],
    queryFn: async () =>
      apiFetch<{ data: ReceiptRow[]; meta: { total: number } }>(
        `/me/receipts${qs({ page, pageSize: 20 })}`,
      ),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Receipts"
        description="Download the official receipt for any payment you have made."
        backHref="/student/fees"
        backLabel="Fees"
      />

      {error ? (
        <ErrorState message="Your receipts could not be loaded." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : (data?.data.length ?? 0) === 0 ? (
        <EmptyState
          title="No receipts yet"
          description="A receipt is available after the front desk posts a payment."
          icon={<Receipt className="h-5 w-5" />}
        />
      ) : (
        <>
          <div className="space-y-3">
            {data?.data.map((receipt) => (
              <Card key={receipt.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-mono text-sm font-medium">{receipt.paymentNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateTimeLabel(receipt.receivedAt)} · {receipt.invoice.invoiceNumber} ·{' '}
                      {receipt.method.replace(/_/g, ' ').toLowerCase()}
                    </p>
                    {receipt.reference ? (
                      <p className="text-xs text-muted-foreground">Ref {receipt.reference}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={receipt.status} />
                    <p className="font-medium tabular-nums">{money(receipt.amountMinor, receipt.currency)}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void downloadFile(`/me/receipts/${receipt.id}/download`, `${receipt.paymentNumber}.pdf`).catch(
                          (downloadError) => toast.error(formatApiError(downloadError)),
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination page={page} pageSize={20} total={data?.meta.total ?? 0} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
