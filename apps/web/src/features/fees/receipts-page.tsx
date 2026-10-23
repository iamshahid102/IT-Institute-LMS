'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, downloadFile, formatApiError } from '@/lib/api';
import { dateTimeLabel, money } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface PaymentRow {
  id: string;
  paymentNumber: string;
  amountMinor: number;
  reversedAmountMinor: number;
  currency: string;
  method: string;
  status: string;
  reference: string | null;
  receivedAt: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    enrollment: {
      student: { id: string; studentNumber: string; fullName: string };
      batch: { code: string };
    };
  };
}

export function ReceiptsPage({ mode }: { mode: 'admin' | 'front-desk' }) {
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [method, setMethod] = React.useState('ALL');
  const [page, setPage] = React.useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['payments', page, method, debouncedSearch],
    queryFn: async () =>
      apiFetch<{ data: PaymentRow[]; meta: { total: number } }>(
        `/payments${qs({
          page,
          pageSize: 20,
          method: method === 'ALL' ? undefined : method,
          search: debouncedSearch || undefined,
        })}`,
      ),
  });

  const columns = React.useMemo<ColumnDef<PaymentRow, unknown>[]>(
    () => [
      {
        id: 'receipt',
        header: 'Receipt',
        accessorKey: 'paymentNumber',
        cell: ({ row }) => (
          <div>
            <p className="font-mono text-sm font-medium">{row.original.paymentNumber}</p>
            <p className="text-xs text-muted-foreground">{dateTimeLabel(row.original.receivedAt)}</p>
          </div>
        ),
      },
      {
        id: 'student',
        header: 'Student',
        accessorFn: (row) => row.invoice.enrollment.student.fullName,
        cell: ({ row }) => (
          <div>
            <p className="text-sm">{row.original.invoice.enrollment.student.fullName}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {row.original.invoice.enrollment.student.studentNumber} · {row.original.invoice.enrollment.batch.code}
            </p>
          </div>
        ),
      },
      {
        id: 'invoice',
        header: 'Invoice',
        accessorFn: (row) => row.invoice.invoiceNumber,
        cell: ({ row }) => (
          <Link href={`${base}/fees/${row.original.invoice.id}`} className="font-mono text-xs hover:underline">
            {row.original.invoice.invoiceNumber}
          </Link>
        ),
      },
      {
        id: 'method',
        header: 'Method',
        accessorKey: 'method',
        cell: ({ row }) => (
          <span className="text-sm capitalize">{row.original.method.replace(/_/g, ' ').toLowerCase()}</span>
        ),
      },
      {
        id: 'amount',
        header: 'Amount',
        accessorKey: 'amountMinor',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium tabular-nums">
              {money(row.original.amountMinor - row.original.reversedAmountMinor, row.original.currency)}
            </p>
            {row.original.reversedAmountMinor > 0 ? (
              <p className="text-xs text-destructive">−{money(row.original.reversedAmountMinor, row.original.currency)} reversed</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void downloadFile(`/payments/${row.original.id}/receipt`, `${row.original.paymentNumber}.pdf`).catch(
                (downloadError) => toast.error(formatApiError(downloadError)),
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> Receipt
          </Button>
        ),
      },
    ],
    [base],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payments & receipts"
        description="Every posted payment with its official receipt. Reversals are recorded separately."
        backHref={`${base}/fees`}
        backLabel="Invoices"
      />

      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-card sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search receipt, invoice or student"
            className="pl-9"
            aria-label="Search receipts"
          />
        </div>
        <Select
          value={method}
          onValueChange={(value) => {
            setMethod(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Payment method">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All methods</SelectItem>
            <SelectItem value="CASH">Cash</SelectItem>
            <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
            <SelectItem value="CARD">Card</SelectItem>
            <SelectItem value="JAZZCASH">JazzCash</SelectItem>
            <SelectItem value="EASYPAISA">Easypaisa</SelectItem>
            <SelectItem value="CHEQUE">Cheque</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState message="Payments could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            emptyTitle="No payments recorded"
            emptyDescription="Receipts appear here after a payment is posted."
          />
          <Pagination page={page} pageSize={20} total={data?.meta.total ?? 0} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
