'use client';

import * as React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, Trash2 } from 'lucide-react';
import { toMinorUnits } from '@lms/shared';
import { apiFetch, formatApiError } from '@/lib/api';
import { localDateInput } from '@/lib/format';
import { useEnrollmentSearch } from '@/features/shared/options';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const schema = z.object({
  dueAt: z.string().min(1, 'Select a due date.'),
  discount: z.string().optional(),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(2, 'Describe this line item.').max(160),
        quantity: z.string().refine((value) => Number(value) >= 1 && Number(value) <= 100, 'Quantity 1–100.'),
        amount: z.string().refine((value) => toMinorUnits(value) !== null, 'Enter a valid amount.'),
        itemType: z.enum(['TUITION', 'ADMISSION', 'EXAM', 'MATERIAL', 'OTHER']),
      }),
    )
    .min(1),
});

type FormValues = z.infer<typeof schema>;

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId?: string;
  enrollmentLabel?: string;
}

export function InvoiceDialog({ open, onOpenChange, enrollmentId, enrollmentLabel }: InvoiceDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const enrollments = useEnrollmentSearch(debouncedSearch);
  const [selected, setSelected] = React.useState<{ id: string; label: string } | null>(
    enrollmentId && enrollmentLabel ? { id: enrollmentId, label: enrollmentLabel } : null,
  );
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      dueAt: localDateInput(new Date(Date.now() + 14 * 864e5)),
      discount: '',
      notes: '',
      items: [{ description: 'Tuition fee', quantity: '1', amount: '', itemType: 'TUITION' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  React.useEffect(() => {
    if (!open) {
      setServerError(null);
      if (!enrollmentId) setSelected(null);
    }
  }, [open, enrollmentId]);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    if (!selected) {
      setServerError('Select an enrollment before creating an invoice.');
      return;
    }

    const items = [];
    for (const item of values.items) {
      const minor = toMinorUnits(item.amount);
      if (minor === null) {
        setServerError('One of the line amounts is invalid.');
        return;
      }
      items.push({
        description: item.description,
        quantity: Number(item.quantity),
        unitAmountMinor: minor,
        itemType: item.itemType,
      });
    }

    const discountMinor = values.discount ? toMinorUnits(values.discount) : 0;
    if (discountMinor === null) {
      setServerError('Enter a valid discount amount.');
      return;
    }

    try {
      const result = await apiFetch<{ data: { invoiceNumber: string } }>('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          enrollmentId: selected.id,
          dueAt: values.dueAt,
          discountMinor,
          notes: values.notes || undefined,
          items,
        }),
      });
      toast.success(`Invoice ${result.data.invoiceNumber} created.`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['enrollment'] });
      queryClient.invalidateQueries({ queryKey: ['student'] });
      onOpenChange(false);
      form.reset({
        dueAt: localDateInput(new Date(Date.now() + 14 * 864e5)),
        discount: '',
        notes: '',
        items: [{ description: 'Tuition fee', quantity: '1', amount: '', itemType: 'TUITION' }],
      });
    } catch (error) {
      setServerError(formatApiError(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create invoice</DialogTitle>
          <DialogDescription>
            Totals are calculated by the server from the line items and discount.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormErrorSummary message={serverError} />

          {enrollmentId ? (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">{enrollmentLabel}</div>
          ) : selected ? (
            <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span>{selected.label}</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(null)}>
                Change
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">Enrollment</p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search student or batch"
                  className="pl-9"
                />
              </div>
              <div className="max-h-36 overflow-y-auto rounded-lg border">
                {enrollments.isLoading ? (
                  <Skeleton className="m-2 h-10" />
                ) : (enrollments.data?.length ?? 0) === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">No enrollments match that search.</p>
                ) : (
                  enrollments.data?.map((enrollment) => (
                    <button
                      key={enrollment.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
                      onClick={() =>
                        setSelected({
                          id: enrollment.id,
                          label: `${enrollment.student.fullName} · ${enrollment.batch.code} · ${enrollment.status}`,
                        })
                      }
                    >
                      <span>{enrollment.student.fullName}</span>
                      <span className="text-xs text-muted-foreground">{enrollment.batch.code}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Line items</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => append({ description: '', quantity: '1', amount: '', itemType: 'TUITION' })}
              >
                <Plus className="h-3.5 w-3.5" /> Add line
              </Button>
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_70px_110px_130px_36px]">
                <FormField label="Description" error={form.formState.errors.items?.[index]?.description?.message}>
                  <Input {...form.register(`items.${index}.description`)} placeholder="Tuition — installment 1" />
                </FormField>
                <FormField label="Qty" error={form.formState.errors.items?.[index]?.quantity?.message}>
                  <Input {...form.register(`items.${index}.quantity`)} inputMode="numeric" />
                </FormField>
                <FormField label="Unit (PKR)" error={form.formState.errors.items?.[index]?.amount?.message}>
                  <Input {...form.register(`items.${index}.amount`)} inputMode="decimal" placeholder="30000.00" />
                </FormField>
                <FormField label="Type">
                  <Select
                    value={form.watch(`items.${index}.itemType`)}
                    onValueChange={(value) =>
                      form.setValue(`items.${index}.itemType`, value as FormValues['items'][number]['itemType'])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TUITION">Tuition</SelectItem>
                      <SelectItem value="ADMISSION">Admission</SelectItem>
                      <SelectItem value="EXAM">Exam</SelectItem>
                      <SelectItem value="MATERIAL">Material</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <div className="flex items-end pb-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove line"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Due date" error={form.formState.errors.dueAt?.message} required>
              <Input type="date" {...form.register('dueAt')} />
            </FormField>
            <FormField label="Discount (PKR)" error={form.formState.errors.discount?.message}>
              <Input {...form.register('discount')} inputMode="decimal" placeholder="0.00" />
            </FormField>
            <FormField label="Notes" error={form.formState.errors.notes?.message}>
              <Input {...form.register('notes')} placeholder="Optional" />
            </FormField>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating…' : 'Create invoice'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
