'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Download, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { toMinorUnits } from '@lms/shared';
import { apiFetch, downloadFile, formatApiError } from '@/lib/api';
import { dateLabel, dateTimeLabel, fromMinorUnits, money } from '@/lib/format';
import { useAuth } from '@/features/auth/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';
import { PaymentDialog, type PayableInvoice } from './payment-dialog';

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
  notes: string | null;
  receivedBy: { fullName: string } | null;
  reversals: Array<{ id: string; amountMinor: number; reason: string; createdAt: string }>;
}

interface InvoiceDetail extends PayableInvoice {
  invoiceNumber: string;
  status: string;
  issuedAt: string;
  dueAt: string;
  subtotalMinor: number;
  discountMinor: number;
  currency: string;
  notes: string | null;
  items: Array<{ id: string; description: string; quantity: number; unitAmountMinor: number; lineTotalMinor: number; itemType: string }>;
  payments: PaymentRow[];
  enrollment: {
    id: string;
    student: { id: string; studentNumber: string; fullName: string; phone: string; email: string | null };
    batch: { code: string; name: string; course: { code: string; title: string } };
  };
}

export function InvoiceDetail({ invoiceId, mode }: { invoiceId: string; mode: 'admin' | 'front-desk' }) {
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [payOpen, setPayOpen] = React.useState(false);
  const [reversing, setReversing] = React.useState<PaymentRow | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => (await apiFetch<{ data: InvoiceDetail }>(`/invoices/${invoiceId}`)).data,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error || !data) return <ErrorState message="This invoice could not be loaded." onRetry={() => void refetch()} />;

  const currency = data.currency;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Invoice ${data.invoiceNumber}`}
        description={`${data.enrollment.student.fullName} · ${data.enrollment.batch.course.title} · ${data.enrollment.batch.code}`}
        backHref={`${base}/fees`}
        backLabel="Invoices"
        actions={
          <>
            <StatusBadge status={data.status} />
            {can('fee.payment.receive') && data.outstandingMinor > 0 && data.status !== 'VOID' ? (
              <Button onClick={() => setPayOpen(true)}>
                <Receipt className="h-4 w-4" /> Record payment
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoice total</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{money(data.totalMinor, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600">{money(data.paidMinor, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${data.outstandingMinor > 0 ? 'text-destructive' : ''}`}>
              {money(data.outstandingMinor, currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Due date</p>
            <p className="mt-1 text-xl font-semibold">{dateLabel(data.dueAt)}</p>
            <p className="text-xs text-muted-foreground">Issued {dateLabel(data.issuedAt)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Line items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium tabular-nums">Qty</th>
                  <th className="px-3 py-2 text-right font-medium tabular-nums">Unit</th>
                  <th className="px-4 py-2 text-right font-medium tabular-nums">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5">
                      <p>{item.description}</p>
                      <p className="text-xs text-muted-foreground">{item.itemType.toLowerCase()}</p>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(item.unitAmountMinor, currency)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(item.lineTotalMinor, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30 text-sm">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">
                    Subtotal
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(data.subtotalMinor, currency)}</td>
                </tr>
                {data.discountMinor > 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">
                      Discount
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">−{money(data.discountMinor, currency)}</td>
                  </tr>
                ) : null}
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right font-medium">
                    Total
                  </td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{money(data.totalMinor, currency)}</td>
                </tr>
              </tfoot>
            </table>
            {data.notes ? <p className="border-t p-4 text-xs text-muted-foreground">{data.notes}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments have been recorded for this invoice.</p>
            ) : (
              data.payments.map((payment) => {
                const net = payment.amountMinor - payment.reversedAmountMinor;
                return (
                  <div key={payment.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-sm font-medium">{payment.paymentNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {dateTimeLabel(payment.receivedAt)} · {payment.method.replace(/_/g, ' ').toLowerCase()}
                          {payment.reference ? ` · ${payment.reference}` : ''}
                        </p>
                        {payment.receivedBy ? (
                          <p className="text-xs text-muted-foreground">Received by {payment.receivedBy.fullName}</p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="font-medium tabular-nums">{money(net, currency)}</p>
                        <StatusBadge status={payment.status} />
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void downloadFile(`/payments/${payment.id}/receipt`, `${payment.paymentNumber}.pdf`).catch(
                            (downloadError) => toast.error(formatApiError(downloadError)),
                          )
                        }
                      >
                        <Download className="h-3.5 w-3.5" /> Receipt
                      </Button>
                      {can('fee.reverse') && net > 0 ? (
                        <Button size="sm" variant="ghost" onClick={() => setReversing(payment)}>
                          <ArrowLeftRight className="h-3.5 w-3.5" /> Reverse
                        </Button>
                      ) : null}
                    </div>
                    {payment.reversals.length > 0 ? (
                      <ul className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                        {payment.reversals.map((reversal) => (
                          <li key={reversal.id}>
                            Reversed {money(reversal.amountMinor, currency)} on {dateLabel(reversal.createdAt)} —{' '}
                            {reversal.reason}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        invoice={data}
        onPaid={() => {
          void queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
          void refetch();
        }}
      />

      <ReversalDialog
        payment={reversing}
        currency={currency}
        onOpenChange={(open) => !open && setReversing(null)}
        onReversed={() => void refetch()}
      />
    </div>
  );
}

function ReversalDialog({
  payment,
  currency,
  onOpenChange,
  onReversed,
}: {
  payment: PaymentRow | null;
  currency: string;
  onOpenChange: (open: boolean) => void;
  onReversed: () => void;
}) {
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const remaining = payment ? payment.amountMinor - payment.reversedAmountMinor : 0;

  React.useEffect(() => {
    setAmount(payment ? fromMinorUnits(remaining) : '');
    setReason('');
    setError(null);
  }, [payment, remaining]);

  const submit = async () => {
    if (!payment) return;
    const amountMinor = toMinorUnits(amount);
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter a valid reversal amount.');
      return;
    }
    if (amountMinor > remaining) {
      setError(`The reversal cannot exceed the remaining ${money(remaining, currency)}.`);
      return;
    }
    if (reason.trim().length < 5) {
      setError('Provide a reversal reason of at least 5 characters.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/payments/${payment.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ amountMinor, reason: reason.trim() }),
      });
      toast.success('Payment reversed. The adjustment is recorded in the ledger.');
      onReversed();
      onOpenChange(false);
    } catch (reversalError) {
      setError(formatApiError(reversalError));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={Boolean(payment)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reverse payment</DialogTitle>
          <DialogDescription>
            {payment ? `Receipt ${payment.paymentNumber} · ${money(remaining, currency)} available to reverse.` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormErrorSummary message={error} />
          <FormField label={`Amount (${currency})`} required>
            <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
          </FormField>
          <FormField label="Reason" required hint="Stored with the reversal and written to the audit log.">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Cheque bounced after deposit."
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void submit()} disabled={pending}>
              {pending ? 'Reversing…' : 'Reverse payment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
