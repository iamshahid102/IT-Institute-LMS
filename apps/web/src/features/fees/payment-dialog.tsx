'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { toMinorUnits } from '@lms/shared';
import { apiFetch, downloadFile, formatApiError } from '@/lib/api';
import { fromMinorUnits, money } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface PayableInvoice {
  id: string;
  invoiceNumber: string;
  totalMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  currency?: string;
}

const schema = z.object({
  amount: z.string().refine((value) => {
    const minor = toMinorUnits(value);
    return minor !== null && minor > 0;
  }, 'Enter an amount greater than zero.'),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'JAZZCASH', 'EASYPAISA', 'CHEQUE', 'OTHER']),
  reference: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

export function PaymentDialog({
  open,
  onOpenChange,
  invoice,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PayableInvoice | null;
  onPaid?: () => void;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = React.useState(() => crypto.randomUUID());
  const [receipt, setReceipt] = React.useState<{ id: string; paymentNumber: string } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', method: 'CASH', reference: '', notes: '' },
  });

  React.useEffect(() => {
    if (!open) return;
    setServerError(null);
    setReceipt(null);
    setIdempotencyKey(crypto.randomUUID());
    form.reset({
      amount: invoice ? fromMinorUnits(invoice.outstandingMinor) : '',
      method: 'CASH',
      reference: '',
      notes: '',
    });
  }, [open, invoice, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!invoice) return;
    setServerError(null);
    const amountMinor = toMinorUnits(values.amount);
    if (amountMinor === null || amountMinor <= 0) {
      setServerError('Enter a valid payment amount.');
      return;
    }
    if (amountMinor > invoice.outstandingMinor) {
      setServerError(
        `The amount exceeds the outstanding balance of ${money(invoice.outstandingMinor, invoice.currency ?? 'PKR')}.`,
      );
      return;
    }

    try {
      const result = await apiFetch<{ data: { id: string; paymentNumber: string } }>('/payments', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          invoiceId: invoice.id,
          amountMinor,
          method: values.method,
          reference: values.reference || undefined,
          notes: values.notes || undefined,
        }),
      });
      setReceipt({ id: result.data.id, paymentNumber: result.data.paymentNumber });
      toast.success(`Payment ${result.data.paymentNumber} posted.`);
      form.reset({ amount: '', method: 'CASH', reference: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding'] });
      queryClient.invalidateQueries({ queryKey: ['student'] });
      onPaid?.();
    } catch (error) {
      setServerError(formatApiError(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {invoice
              ? `Invoice ${invoice.invoiceNumber} · outstanding ${money(invoice.outstandingMinor, invoice.currency ?? 'PKR')}`
              : 'Select an invoice to collect a payment.'}
          </DialogDescription>
        </DialogHeader>

        {receipt ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Payment {receipt.paymentNumber} has been posted. The receipt is available now.</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={() =>
                  void downloadFile(`/payments/${receipt.id}/receipt`, `${receipt.paymentNumber}.pdf`).catch((error) =>
                    toast.error(formatApiError(error)),
                  )
                }
              >
                <Download className="h-4 w-4" /> Download receipt
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormErrorSummary message={serverError} />
            <FormField label={`Amount (${invoice?.currency ?? 'PKR'})`} error={form.formState.errors.amount?.message} required>
              <Input {...form.register('amount')} inputMode="decimal" placeholder="15000.00" autoFocus />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Method" error={form.formState.errors.method?.message} required>
                <Select
                  value={form.watch('method')}
                  onValueChange={(value) => form.setValue('method', value as FormValues['method'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="JAZZCASH">JazzCash</SelectItem>
                    <SelectItem value="EASYPAISA">Easypaisa</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Reference" error={form.formState.errors.reference?.message} hint="Cheque or transaction ID.">
                <Input {...form.register('reference')} placeholder="Optional" />
              </FormField>
            </div>
            <FormField label="Notes" error={form.formState.errors.notes?.message}>
              <Input {...form.register('notes')} placeholder="Optional internal note" />
            </FormField>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" /> Amounts are validated by the server; retries cannot post twice.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting || !invoice}>
                {form.formState.isSubmitting ? 'Posting…' : 'Post payment'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
