'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  CalendarDays,
  ClipboardCheck,
  FileBadge,
  FileText,
  GraduationCap,
  Plus,
  Receipt,
  Settings2,
  Users,
} from 'lucide-react';
import { apiFetch, formatApiError } from '@/lib/api';
import { dateLabel, localDateInput, money, percent } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InvoiceDialog } from '@/features/fees/invoice-dialog';

interface EnrollmentDetailData {
  id: string;
  status: string;
  joinedAt: string;
  completedAt: string | null;
  agreedFeeMinor: number;
  currency: string;
  notes: string | null;
  student: { id: string; studentNumber: string; fullName: string; phone: string; email: string | null; status: string };
  batch: {
    id: string;
    code: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
    course: { id: string; code: string; title: string };
    instructor: { id: string; fullName: string } | null;
  };
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    issuedAt: string;
    dueAt: string;
    totalMinor: number;
    status: string;
    payments: Array<{ amountMinor: number; reversedAmountMinor: number }>;
  }>;
  certificates: Array<{ id: string; certificateNumber: string; status: string; issuedAt: string; revokedAt: string | null }>;
  results: Array<{
    id: string;
    marksObtained: number;
    status: string;
    assessment: { id: string; title: string; maxMarks: number; passMarks: number };
  }>;
  attendance: {
    percentage: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    eligibleSessions: number;
  };
  fees: { billedMinor: number; paidMinor: number; outstandingMinor: number };
}

const planSchema = z.object({
  installmentCount: z.string().refine((value) => Number(value) >= 1 && Number(value) <= 12, '1–12 installments.'),
  firstDueAt: z.string().min(1, 'Select the first due date.'),
  intervalDays: z.string().refine((value) => Number(value) >= 7 && Number(value) <= 180, '7–180 days.'),
});

const statusSchema = z.object({ status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'WITHDRAWN', 'SUSPENDED']) });

type PlanValues = z.infer<typeof planSchema>;
type StatusValues = z.infer<typeof statusSchema>;

export function EnrollmentDetail({ enrollmentId, mode }: { enrollmentId: string; mode: 'admin' | 'front-desk' }) {
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const queryClient = useQueryClient();
  const [invoiceOpen, setInvoiceOpen] = React.useState(false);
  const [planOpen, setPlanOpen] = React.useState(false);
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [planError, setPlanError] = React.useState<string | null>(null);
  const [statusError, setStatusError] = React.useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['enrollment', enrollmentId],
    queryFn: async () => {
      const result = await apiFetch<{ data: EnrollmentDetailData }>(`/enrollments/${enrollmentId}`);
      return result.data;
    },
  });

  const planForm = useForm<PlanValues>({
    resolver: zodResolver(planSchema),
    defaultValues: { installmentCount: '2', firstDueAt: localDateInput(), intervalDays: '30' },
  });

  const statusForm = useForm<StatusValues>({
    resolver: zodResolver(statusSchema),
    defaultValues: { status: 'ACTIVE' },
  });

  React.useEffect(() => {
    if (data) statusForm.setValue('status', data.status as StatusValues['status']);
  }, [data, statusForm]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState message="This enrollment could not be loaded." onRetry={() => void refetch()} />;
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['enrollment', enrollmentId] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['enrollments'] });
    queryClient.invalidateQueries({ queryKey: ['student'] });
  };

  const generatePlan = planForm.handleSubmit(async (values) => {
    setPlanError(null);
    try {
      const result = await apiFetch<{ data: Array<{ invoiceNumber: string }> }>('/invoices/plan', {
        method: 'POST',
        body: JSON.stringify({
          enrollmentId,
          installmentCount: Number(values.installmentCount),
          firstDueAt: values.firstDueAt,
          intervalDays: Number(values.intervalDays),
        }),
      });
      toast.success(`${result.data.length} installment invoices created.`);
      setPlanOpen(false);
      invalidate();
    } catch (submitError) {
      setPlanError(formatApiError(submitError));
    }
  });

  const changeStatus = statusForm.handleSubmit(async (values) => {
    setStatusError(null);
    try {
      await apiFetch(`/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: values.status }),
      });
      toast.success('Enrollment status updated.');
      setStatusOpen(false);
      invalidate();
    } catch (submitError) {
      setStatusError(formatApiError(submitError));
    }
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${data.student.fullName} · ${data.batch.course.title}`}
        description={`${data.batch.code} · ${data.batch.name} · joined ${dateLabel(data.joinedAt)}`}
        backHref={`${base}/enrollments`}
        actions={
          <>
            <StatusBadge status={data.status} />
            <Button size="sm" variant="outline" onClick={() => setStatusOpen(true)}>
              <Settings2 className="h-4 w-4" /> Change status
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPlanOpen(true)}>
              <CalendarDays className="h-4 w-4" /> Generate installments
            </Button>
            <Button size="sm" onClick={() => setInvoiceOpen(true)}>
              <Plus className="h-4 w-4" /> New invoice
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Attendance"
          value={percent(data.attendance.percentage)}
          hint={`${data.attendance.present} present of ${data.attendance.eligibleSessions} eligible sessions`}
          icon={<ClipboardCheck className="h-5 w-5" />}
          tone={data.attendance.percentage >= 75 ? 'success' : 'warning'}
        />
        <MetricCard label="Agreed fee" value={money(data.agreedFeeMinor, data.currency)} hint="Enrollment agreement" icon={<GraduationCap className="h-5 w-5" />} />
        <MetricCard label="Billed" value={money(data.fees.billedMinor, data.currency)} hint={`${data.invoices.length} invoices`} icon={<FileText className="h-5 w-5" />} />
        <MetricCard
          label="Outstanding"
          value={money(data.fees.outstandingMinor, data.currency)}
          hint={`${money(data.fees.paidMinor, data.currency)} paid`}
          icon={<Receipt className="h-5 w-5" />}
          tone={data.fees.outstandingMinor > 0 ? 'warning' : 'success'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Receipt className="h-4 w-4 text-primary" /> Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.invoices.length === 0 ? (
              <EmptyState
                title="No invoices issued"
                description="Generate an installment schedule or create a single invoice."
                icon={<Receipt className="h-5 w-5" />}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Invoice</th>
                      <th className="px-3 py-2 font-medium">Due</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th className="px-3 py-2 text-right font-medium">Outstanding</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((invoice) => {
                      const paid = invoice.payments.reduce(
                        (sum, payment) => sum + payment.amountMinor - payment.reversedAmountMinor,
                        0,
                      );
                      return (
                        <tr key={invoice.id} className="border-t">
                          <td className="px-3 py-3">
                            <Link
                              href={`${base}/fees/invoices/${invoice.id}`}
                              className="font-mono text-xs text-primary hover:underline"
                            >
                              {invoice.invoiceNumber}
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{dateLabel(invoice.dueAt)}</td>
                          <td className="px-3 py-3 text-right">{money(invoice.totalMinor, data.currency)}</td>
                          <td className="px-3 py-3 text-right">{money(Math.max(0, invoice.totalMinor - paid), data.currency)}</td>
                          <td className="px-3 py-3">
                            <StatusBadge status={invoice.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-primary" /> Student & batch
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">
                <Link href={`${base}/students/${data.student.id}`} className="hover:underline">
                  {data.student.fullName}
                </Link>
              </p>
              <p className="font-mono text-xs text-muted-foreground">{data.student.studentNumber}</p>
              <p className="text-xs text-muted-foreground">{data.student.phone}</p>
              <div className="border-t pt-2 text-xs text-muted-foreground">
                <p>{data.batch.course.title}</p>
                <p>{data.batch.name}</p>
                <p>
                  {dateLabel(data.batch.startDate)} – {dateLabel(data.batch.endDate)}
                </p>
                {data.batch.instructor ? <p>Instructor: {data.batch.instructor.fullName}</p> : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardCheck className="h-4 w-4 text-primary" /> Assessment results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.results.length === 0 ? (
                <p className="text-sm text-muted-foreground">No results recorded.</p>
              ) : (
                data.results.map((result) => (
                  <div key={result.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm">
                    <div>
                      <p className="font-medium">{result.assessment.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {result.marksObtained}/{result.assessment.maxMarks} · pass {result.assessment.passMarks}
                      </p>
                    </div>
                    <StatusBadge status={result.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <FileBadge className="h-4 w-4 text-primary" /> Certificates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.certificates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No certificate issued for this enrollment.</p>
              ) : (
                data.certificates.map((certificate) => (
                  <div key={certificate.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm">
                    <div>
                      <p className="font-mono text-xs">{certificate.certificateNumber}</p>
                      <p className="text-xs text-muted-foreground">Issued {dateLabel(certificate.issuedAt)}</p>
                    </div>
                    <StatusBadge status={certificate.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <InvoiceDialog
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        enrollmentId={data.id}
        enrollmentLabel={`${data.student.fullName} · ${data.batch.code}`}
      />

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate installment plan</DialogTitle>
            <DialogDescription>
              Creates invoices from the agreed fee of {money(data.agreedFeeMinor, data.currency)}. The final
              installment carries any rounding remainder.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={generatePlan} className="space-y-4" noValidate>
            <FormErrorSummary message={planError} />
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Installments" error={planForm.formState.errors.installmentCount?.message} required>
                <Input {...planForm.register('installmentCount')} inputMode="numeric" />
              </FormField>
              <FormField label="First due" error={planForm.formState.errors.firstDueAt?.message} required>
                <Input type="date" {...planForm.register('firstDueAt')} />
              </FormField>
              <FormField label="Interval (days)" error={planForm.formState.errors.intervalDays?.message} required>
                <Input {...planForm.register('intervalDays')} inputMode="numeric" />
              </FormField>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPlanOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={planForm.formState.isSubmitting}>
                {planForm.formState.isSubmitting ? 'Generating…' : 'Generate invoices'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change enrollment status</DialogTitle>
            <DialogDescription>
              Completing or withdrawing an enrollment fixes its attendance window. Agreed fees cannot change
              after invoices exist.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={changeStatus} className="space-y-4" noValidate>
            <FormErrorSummary message={statusError} />
            <FormField label="New status">
              <Select
                value={statusForm.watch('status')}
                onValueChange={(value) => statusForm.setValue('status', value as StatusValues['status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStatusOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={statusForm.formState.isSubmitting}>
                Update status
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
