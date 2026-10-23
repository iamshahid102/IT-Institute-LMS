'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { dateLabel, money } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/features/auth/auth-context';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { InvoiceDialog } from './invoice-dialog';
import { PaymentDialog, type PayableInvoice } from './payment-dialog';

interface InvoiceRow extends PayableInvoice {
  invoiceNumber: string;
  status: string;
  issuedAt: string;
  dueAt: string;
  totalMinor: number;
  discountMinor: number;
  currency: string;
  enrollment: {
    id: string;
    student: { id: string; studentNumber: string; fullName: string };
    batch: { code: string; name: string };
  };
}

export function InvoicesPage({ mode }: { mode: 'admin' | 'front-desk' }) {
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const { can } = useAuth();
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = React.useState('ALL');
  const [overdueOnly, setOverdueOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [invoiceOpen, setInvoiceOpen] = React.useState(false);
  const [paying, setPaying] = React.useState<PayableInvoice | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['invoices', page, status, overdueOnly, debouncedSearch],
    queryFn: async () =>
      apiFetch<{ data: InvoiceRow[]; meta: { total: number } }>(
        `/invoices${qs({
          page,
          pageSize: 20,
          status: status === 'ALL' ? undefined : status,
          overdue: overdueOnly ? 'true' : undefined,
          search: debouncedSearch || undefined,
        })}`,
      ),
  });

  const columns = React.useMemo<ColumnDef<InvoiceRow, unknown>[]>(
    () => [
      {
        id: 'invoice',
        header: 'Invoice',
        accessorKey: 'invoiceNumber',
        cell: ({ row }) => (
          <div>
            <p className="font-mono text-sm font-medium">{row.original.invoiceNumber}</p>
            <p className="text-xs text-muted-foreground">Issued {dateLabel(row.original.issuedAt)}</p>
          </div>
        ),
      },
      {
        id: 'student',
        header: 'Student',
        accessorFn: (row) => row.enrollment.student.fullName,
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium">{row.original.enrollment.student.fullName}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {row.original.enrollment.student.studentNumber} · {row.original.enrollment.batch.code}
            </p>
          </div>
        ),
      },
      {
        id: 'due',
        header: 'Due',
        accessorKey: 'dueAt',
        cell: ({ row }) => {
          const overdue =
            new Date(row.original.dueAt) < new Date() &&
            ['ISSUED', 'PARTIALLY_PAID'].includes(row.original.status);
          return (
            <span className={overdue ? 'text-sm font-medium text-destructive' : 'text-sm'}>
              {dateLabel(row.original.dueAt)}
            </span>
          );
        },
      },
      {
        id: 'total',
        header: 'Total',
        accessorKey: 'totalMinor',
        cell: ({ row }) => <span className="text-sm tabular-nums">{money(row.original.totalMinor, row.original.currency)}</span>,
      },
      {
        id: 'outstanding',
        header: 'Outstanding',
        accessorKey: 'outstandingMinor',
        cell: ({ row }) => (
          <span className="text-sm font-medium tabular-nums">
            {money(row.original.outstandingMinor, row.original.currency)}
          </span>
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
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" asChild>
              <Link href={`${base}/fees/${row.original.id}`}>View</Link>
            </Button>
            {can('fee.payment.receive') && row.original.outstandingMinor > 0 && row.original.status !== 'VOID' ? (
              <Button size="sm" variant="outline" onClick={() => setPaying(row.original)}>
                Collect
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [base, can],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Invoices"
        description="Invoices, outstanding balances and fee collection."
        actions={
          can('fee.invoice.create') ? (
            <Button onClick={() => setInvoiceOpen(true)}>
              <Plus className="h-4 w-4" /> New invoice
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-card lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search invoice, student or student number"
            className="pl-9"
            aria-label="Search invoices"
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40" aria-label="Invoice status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ISSUED">Issued</SelectItem>
              <SelectItem value="PARTIALLY_PAID">Partially paid</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="VOID">Void</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={overdueOnly ? 'default' : 'outline'}
            onClick={() => {
              setOverdueOnly((current) => !current);
              setPage(1);
            }}
          >
            Overdue only
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorState message="Invoices could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            emptyTitle="No invoices found"
            emptyDescription="Create an invoice for an enrollment to start billing."
          />
          <Pagination page={page} pageSize={20} total={data?.meta.total ?? 0} onPageChange={setPage} />
        </>
      )}

      <InvoiceDialog open={invoiceOpen} onOpenChange={setInvoiceOpen} />
      <PaymentDialog open={Boolean(paying)} onOpenChange={(open) => !open && setPaying(null)} invoice={paying} />
    </div>
  );
}
