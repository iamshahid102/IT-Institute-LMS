'use client';

import * as React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { toMinorUnits } from '@lms/shared';
import { apiFetch, formatApiError } from '@/lib/api';
import { money } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { useCourses } from '@/features/shared/options';

interface FeePlanRow {
  id: string;
  name: string;
  currency: string;
  installmentCount: number;
  description: string | null;
  active: boolean;
  totalMinor: number;
  course: { id: string; code: string; title: string } | null;
  items: Array<{ id: string; description: string; amountMinor: number }>;
}

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a plan name.').max(120),
  courseId: z.string().optional(),
  installmentCount: z.string().refine((value) => {
    const count = Number(value);
    return Number.isInteger(count) && count >= 1 && count <= 12;
  }, 'Use 1–12 installments.'),
  description: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(2, 'Describe this charge.').max(160),
        amount: z.string().refine((value) => toMinorUnits(value) !== null, 'Enter a valid amount.'),
      }),
    )
    .min(1, 'Add at least one charge.'),
});

type FormValues = z.infer<typeof schema>;

export function FeePlansPage({ mode }: { mode: 'admin' | 'front-desk' }) {
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const { can } = useAuth();
  const [open, setOpen] = React.useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['fee-plans'],
    queryFn: async () => (await apiFetch<{ data: FeePlanRow[] }>('/fee-plans')).data,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fee plans"
        description="Reusable fee structures that can be applied when creating invoices."
        backHref={`${base}/fees`}
        backLabel="Invoices"
        actions={
          can('fee.plan.manage') ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New plan
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <ErrorState message="Fee plans could not be loaded." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No fee plans yet"
          description="Create a reusable structure for tuition, admission and exam charges."
          action={
            can('fee.plan.manage') ? (
              <Button size="sm" onClick={() => setOpen(true)}>
                Create a plan
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.map((plan) => (
            <Card key={plan.id}>
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plan.course ? `${plan.course.code} · ${plan.course.title}` : 'All courses'}
                  </p>
                </div>
                <Badge variant={plan.active ? 'success' : 'neutral'}>{plan.active ? 'Active' : 'Inactive'}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">
                    {plan.installmentCount} installment{plan.installmentCount === 1 ? '' : 's'}
                  </span>
                  <span className="text-lg font-semibold tabular-nums">{money(plan.totalMinor, plan.currency)}</span>
                </div>
                <ul className="space-y-1 border-t pt-2 text-sm">
                  {plan.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{item.description}</span>
                      <span className="tabular-nums">{money(item.amountMinor, plan.currency)}</span>
                    </li>
                  ))}
                </ul>
                {plan.description ? <p className="text-xs text-muted-foreground">{plan.description}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FeePlanDialog open={open} onOpenChange={setOpen} onCreated={() => void refetch()} />
    </div>
  );
}

function FeePlanDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const courses = useCourses({ includeAll: true });
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      courseId: '',
      installmentCount: '1',
      description: '',
      items: [{ description: 'Tuition fee', amount: '' }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  React.useEffect(() => {
    if (!open) {
      setServerError(null);
      form.reset({
        name: '',
        courseId: '',
        installmentCount: '1',
        description: '',
        items: [{ description: 'Tuition fee', amount: '' }],
      });
    }
  }, [open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const items = [];
    for (const item of values.items) {
      const minor = toMinorUnits(item.amount);
      if (minor === null) {
        setServerError('One of the amounts is invalid.');
        return;
      }
      items.push({ description: item.description, amountMinor: minor });
    }

    try {
      await apiFetch('/fee-plans', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          courseId: values.courseId || undefined,
          installmentCount: Number(values.installmentCount),
          description: values.description || undefined,
          currency: 'PKR',
          active: true,
          items,
        }),
      });
      toast.success('Fee plan created.');
      onCreated();
      onOpenChange(false);
    } catch (error) {
      setServerError(formatApiError(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New fee plan</DialogTitle>
          <DialogDescription>Plan totals are calculated by the server from the charges.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormErrorSummary message={serverError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Plan name" error={form.formState.errors.name?.message} required>
              <Input {...form.register('name')} placeholder="Full-stack development — standard" />
            </FormField>
            <FormField label="Course" hint="Leave empty to make the plan available for all courses.">
              <Select
                value={form.watch('courseId') || 'ALL'}
                onValueChange={(value) => form.setValue('courseId', value === 'ALL' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All courses</SelectItem>
                  {(courses.data ?? []).map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.code} · {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Installments" error={form.formState.errors.installmentCount?.message} required>
              <Input {...form.register('installmentCount')} inputMode="numeric" />
            </FormField>
            <FormField label="Description" error={form.formState.errors.description?.message}>
              <Input {...form.register('description')} placeholder="Optional" />
            </FormField>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Charges</p>
              <Button type="button" size="sm" variant="outline" onClick={() => append({ description: '', amount: '' })}>
                <Plus className="h-3.5 w-3.5" /> Add charge
              </Button>
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_140px_36px]">
                <FormField label="Description" error={form.formState.errors.items?.[index]?.description?.message}>
                  <Input {...form.register(`items.${index}.description`)} placeholder="Tuition fee" />
                </FormField>
                <FormField label="Amount (PKR)" error={form.formState.errors.items?.[index]?.amount?.message}>
                  <Input {...form.register(`items.${index}.amount`)} inputMode="decimal" placeholder="45000.00" />
                </FormField>
                <div className="flex items-end pb-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remove charge"
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating…' : 'Create plan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
