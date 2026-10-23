'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Archive,
  BadgeCheck,
  CalendarDays,
  ClipboardCheck,
  FileBadge,
  GraduationCap,
  KeyRound,
  Mail,
  Pencil,
  Phone,
  Plus,
  Receipt,
  UserRound,
} from 'lucide-react';
import { apiFetch, downloadFile, formatApiError } from '@/lib/api';
import { dateLabel, money } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { EnrollDialog } from '@/features/enrollments/enroll-dialog';

interface StudentDetailData {
  id: string;
  studentNumber: string;
  fullName: string;
  guardianName: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  dateOfBirth: string | null;
  admissionDate: string;
  status: string;
  notes: string | null;
  hasPortalAccount: boolean;
  archivedAt: string | null;
  enrollments: Array<{
    id: string;
    status: string;
    joinedAt: string;
    completedAt: string | null;
    agreedFeeMinor: number;
    currency: string;
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
  }>;
  summary: {
    activeEnrollments: number;
    totalBilledMinor: number;
    totalPaidMinor: number;
    outstandingMinor: number;
    invoiceCount: number;
    issuedCertificates: number;
  };
}

interface AttendanceRow {
  id: string;
  status: string;
  method: string;
  markedAt: string;
  remarks: string | null;
  correctionReason: string | null;
  correctedAt: string | null;
  session: { id: string; startsAt: string; status: string; topic: string | null; batch: { code: string; name: string } };
}

interface LedgerEntry {
  type: string;
  date: string;
  reference: string;
  description: string;
  debitMinor: number;
  creditMinor: number;
}

interface CertificateRow {
  id: string;
  certificateNumber: string;
  status: string;
  issuedAt: string;
  courseTitle: string;
  courseCode: string;
}

const accountSchema = z.object({
  email: z.string().min(1, 'Enter an email address.').pipe(z.email('Enter a valid email address.')),
  password: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/\d/, 'Include at least one number.'),
});

type AccountValues = z.infer<typeof accountSchema>;

export function StudentDetail({ studentId, mode }: { studentId: string; mode: 'admin' | 'front-desk' }) {
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const queryClient = useQueryClient();
  const [enrollOpen, setEnrollOpen] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const [accountError, setAccountError] = React.useState<string | null>(null);

  const detail = useQuery({
    queryKey: ['student', studentId],
    queryFn: async () => {
      const result = await apiFetch<{ data: StudentDetailData }>(`/students/${studentId}`);
      return result.data;
    },
  });

  const attendance = useQuery({
    queryKey: ['student', studentId, 'attendance'],
    queryFn: async () => {
      const result = await apiFetch<{ data: AttendanceRow[] }>(`/students/${studentId}/attendance`);
      return result.data;
    },
  });

  const ledger = useQuery({
    queryKey: ['student', studentId, 'ledger'],
    queryFn: async () => {
      const result = await apiFetch<{ data: { entries: LedgerEntry[]; summary: Record<string, number> } }>(
        `/students/${studentId}/fee-ledger`,
      );
      return result.data;
    },
  });

  const certificates = useQuery({
    queryKey: ['student', studentId, 'certificates'],
    queryFn: async () => {
      const result = await apiFetch<{ data: CertificateRow[] }>(`/students/${studentId}/certificates`);
      return result.data;
    },
  });

  const accountForm = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { email: '', password: '' },
  });

  React.useEffect(() => {
    if (detail.data?.email) accountForm.setValue('email', detail.data.email);
  }, [detail.data?.email, accountForm]);

  if (detail.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (detail.error || !detail.data) {
    return <ErrorState message="This student record could not be loaded." onRetry={() => void detail.refetch()} />;
  }

  const student = detail.data;
  const archived = student.status === 'ARCHIVED';

  const createAccount = accountForm.handleSubmit(async (values) => {
    setAccountError(null);
    try {
      await apiFetch(`/students/${studentId}/account`, { method: 'POST', body: JSON.stringify(values) });
      toast.success('Portal account created.');
      setAccountOpen(false);
      accountForm.reset();
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
    } catch (error) {
      setAccountError(formatApiError(error));
    }
  });

  const archive = async () => {
    setArchiving(true);
    try {
      await apiFetch(`/students/${studentId}/archive`, { method: 'POST' });
      toast.success('Student archived. History has been preserved.');
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={student.fullName}
        description={`${student.studentNumber} · admitted ${dateLabel(student.admissionDate)}`}
        backHref={`${base}/students`}
        actions={
          <>
            <StatusBadge status={student.status} />
            {!archived ? (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`${base}/students/${studentId}/edit`}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Link>
                </Button>
                <Button size="sm" onClick={() => setEnrollOpen(true)}>
                  <Plus className="h-4 w-4" /> Enroll
                </Button>
              </>
            ) : null}
            {!student.hasPortalAccount && !archived ? (
              <Button variant="outline" size="sm" onClick={() => setAccountOpen(true)}>
                <KeyRound className="h-4 w-4" /> Portal account
              </Button>
            ) : null}
            {!archived ? (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" className="text-destructive">
                    <Archive className="h-4 w-4" /> Archive
                  </Button>
                }
                title="Archive this student?"
                description="The record will be hidden from active lists and the portal account disabled. Financial and academic history is preserved and cannot be deleted."
                confirmLabel="Archive student"
                destructive
                pending={archiving}
                onConfirm={archive}
              />
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Enrollments" value={student.enrollments.length} hint={`${student.summary.activeEnrollments} active`} icon={<GraduationCap className="h-5 w-5" />} />
        <MetricCard label="Billed" value={money(student.summary.totalBilledMinor)} hint={`${student.summary.invoiceCount} invoices`} icon={<Receipt className="h-5 w-5" />} />
        <MetricCard
          label="Outstanding"
          value={money(student.summary.outstandingMinor)}
          hint={`${money(student.summary.totalPaidMinor)} paid`}
          icon={<Receipt className="h-5 w-5" />}
          tone={student.summary.outstandingMinor > 0 ? 'warning' : 'success'}
        />
        <MetricCard label="Certificates" value={student.summary.issuedCertificates} hint="Issued" icon={<FileBadge className="h-5 w-5" />} tone="success" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Student information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow icon={<UserRound className="h-4 w-4" />} label="Full name" value={student.fullName} />
              <InfoRow icon={<UserRound className="h-4 w-4" />} label="Guardian" value={student.guardianName ?? '—'} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={student.phone} />
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={student.email ?? '—'} />
              <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Date of birth" value={dateLabel(student.dateOfBirth)} />
              <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Admission date" value={dateLabel(student.admissionDate)} />
              <InfoRow icon={<KeyRound className="h-4 w-4" />} label="Portal account" value={student.hasPortalAccount ? 'Linked' : 'Not created'} />
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm">{student.address ?? '—'}</p>
              </div>
              {student.notes ? (
                <div className="sm:col-span-2 lg:col-span-3">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-line text-sm">{student.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrollments">
          {student.enrollments.length === 0 ? (
            <EmptyState
              title="Not enrolled in a batch"
              description="Enroll the student to start recording attendance and fees."
              action={
                !archived ? (
                  <Button size="sm" onClick={() => setEnrollOpen(true)}>
                    <Plus className="h-4 w-4" /> Enroll
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="space-y-2">
              {student.enrollments.map((enrollment) => (
                <Link
                  key={enrollment.id}
                  href={`${base}/enrollments/${enrollment.id}`}
                  className="block rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-primary/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{enrollment.batch.course.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {enrollment.batch.name} · {enrollment.batch.code} · joined {dateLabel(enrollment.joinedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{money(enrollment.agreedFeeMinor, enrollment.currency)}</span>
                      <StatusBadge status={enrollment.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardCheck className="h-4 w-4 text-primary" /> Attendance history
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendance.isLoading ? (
                <Skeleton className="h-32" />
              ) : (attendance.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendance has been recorded for this student yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Session</th>
                        <th className="px-3 py-2 font-medium">Batch</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Marked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(attendance.data ?? []).map((record) => (
                        <tr key={record.id} className="border-t">
                          <td className="px-3 py-3">
                            <p className="font-medium">{record.session.topic ?? 'Class session'}</p>
                            <p className="text-xs text-muted-foreground">{dateLabel(record.session.startsAt)}</p>
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{record.session.batch.code}</td>
                          <td className="px-3 py-3">
                            <StatusBadge status={record.status} />
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">
                            {record.method}
                            {record.correctionReason ? ` · corrected: ${record.correctionReason}` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Receipt className="h-4 w-4 text-primary" /> Fee ledger
              </CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href={`${base}/fees?search=${encodeURIComponent(student.studentNumber)}`}>View invoices</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {ledger.isLoading ? (
                <Skeleton className="h-32" />
              ) : (ledger.data?.entries ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices have been issued for this student.</p>
              ) : (
                <>
                  <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Billed</p>
                      <p className="text-sm font-semibold">{money(ledger.data?.summary.billedMinor ?? 0)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Paid (net)</p>
                      <p className="text-sm font-semibold">{money(ledger.data?.summary.paidMinor ?? 0)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Outstanding</p>
                      <p className="text-sm font-semibold">{money(ledger.data?.summary.outstandingMinor ?? 0)}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium">Reference</th>
                          <th className="px-3 py-2 font-medium">Description</th>
                          <th className="px-3 py-2 text-right font-medium">Charge</th>
                          <th className="px-3 py-2 text-right font-medium">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ledger.data?.entries ?? []).map((entry, index) => (
                          <tr key={`${entry.reference}-${index}`} className="border-t">
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">{dateLabel(entry.date)}</td>
                            <td className="px-3 py-2.5 font-mono text-xs">{entry.reference}</td>
                            <td className="px-3 py-2.5">{entry.description}</td>
                            <td className="px-3 py-2.5 text-right">{entry.debitMinor ? money(entry.debitMinor) : '—'}</td>
                            <td className="px-3 py-2.5 text-right">{entry.creditMinor ? money(entry.creditMinor) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certificates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <FileBadge className="h-4 w-4 text-primary" /> Certificates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {certificates.isLoading ? (
                <Skeleton className="h-24" />
              ) : (certificates.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No certificates have been issued for this student.</p>
              ) : (
                <div className="space-y-2">
                  {(certificates.data ?? []).map((certificate) => (
                    <div key={certificate.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">
                          {certificate.courseTitle} <span className="text-xs text-muted-foreground">({certificate.courseCode})</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {certificate.certificateNumber} · issued {dateLabel(certificate.issuedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={certificate.status} />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            downloadFile(
                              `/certificates/${certificate.id}/download`,
                              `${certificate.certificateNumber}.pdf`,
                            ).catch((error) => toast.error(formatApiError(error)))
                          }
                        >
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <BadgeCheck className="h-3.5 w-3.5" /> Sensitive changes to this record are written to the audit log.
      </p>

      <EnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        studentId={student.id}
        studentName={student.fullName}
        onEnrolled={() => {
          queryClient.invalidateQueries({ queryKey: ['student', studentId] });
        }}
      />

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create portal account</DialogTitle>
            <DialogDescription>
              The student signs in with this email. Share the temporary password securely and ask them to
              change it after first sign-in.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createAccount} className="space-y-4" noValidate>
            <FormErrorSummary message={accountError} />
            <FormField label="Email" htmlFor="account-email" error={accountForm.formState.errors.email?.message} required>
              <Input id="account-email" type="email" {...accountForm.register('email')} />
            </FormField>
            <FormField
              label="Temporary password"
              htmlFor="account-password"
              error={accountForm.formState.errors.password?.message}
              hint="At least 10 characters with a letter and a number."
              required
            >
              <Input id="account-password" type="text" {...accountForm.register('password')} />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAccountOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={accountForm.formState.isSubmitting}>
                Create account
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}

