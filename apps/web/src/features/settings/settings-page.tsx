'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, formatApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LoadingSkeleton } from '@/components/ui/skeleton';
import { FormErrorSummary } from '@/components/ui/form-field';
import { useAuth } from '@/features/auth/auth-context';

interface Settings {
  instituteName: string;
  shortName: string | null;
  currency: string;
  timeZone: string;
  addressLine: string | null;
  phone: string | null;
  email: string | null;
  lateCountsAsPresent: boolean;
  excusedCountsInDenominator: boolean;
  attendanceThresholdPercent: number;
  certificateRequireFullPayment: boolean;
  certificateRequireAttendance: boolean;
  certificateRequireAssessmentsPassed: boolean;
  certificatePublicShowName: boolean;
  receiptPrefix: string;
  certificatePrefix: string;
  signatoryName: string | null;
  signatoryTitle: string | null;
  certificateLegalText: string | null;
}

export function SettingsPage() {
  const { can } = useAuth();
  const [form, setForm] = React.useState<Settings | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await apiFetch<{ data: Settings }>('/settings')).data,
  });

  React.useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (isLoading || !form) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  const editable = can('settings.manage');

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          shortName: form.shortName ?? '',
          addressLine: form.addressLine ?? '',
          phone: form.phone ?? '',
          email: form.email ?? '',
          signatoryName: form.signatoryName ?? '',
          signatoryTitle: form.signatoryTitle ?? '',
          certificateLegalText: form.certificateLegalText ?? '',
          attendanceThresholdPercent: Number(form.attendanceThresholdPercent),
        }),
      });
      toast.success('Institute settings saved.');
      void refetch();
    } catch (saveError) {
      setError(formatApiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Institute settings"
        description="Branding, policies and numbering used across the system."
        actions={
          editable ? (
            <Button onClick={() => void save()} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}
            </Button>
          ) : undefined
        }
      />

      {!editable ? (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          You have read-only access to these settings.
        </p>
      ) : null}
      <div className="max-w-4xl space-y-4">
        <FormErrorSummary message={error} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Institute</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Institute name">
              <Input value={form.instituteName} onChange={(event) => update('instituteName', event.target.value)} disabled={!editable} />
            </Field>
            <Field label="Short name">
              <Input value={form.shortName ?? ''} onChange={(event) => update('shortName', event.target.value)} disabled={!editable} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone ?? ''} onChange={(event) => update('phone', event.target.value)} disabled={!editable} />
            </Field>
            <Field label="Email">
              <Input value={form.email ?? ''} onChange={(event) => update('email', event.target.value)} disabled={!editable} />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input value={form.addressLine ?? ''} onChange={(event) => update('addressLine', event.target.value)} disabled={!editable} />
            </Field>
            <Field label="Currency" hint="Cannot change after invoices exist.">
              <Input value={form.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} disabled={!editable} maxLength={3} />
            </Field>
            <Field label="Time zone" hint="IANA name, e.g. Asia/Karachi.">
              <Input value={form.timeZone} onChange={(event) => update('timeZone', event.target.value)} disabled={!editable} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CheckboxRow
              label="Late counts as present"
              description="When enabled, late arrivals count toward the attendance numerator."
              checked={form.lateCountsAsPresent}
              disabled={!editable}
              onChange={(checked) => update('lateCountsAsPresent', checked)}
            />
            <CheckboxRow
              label="Excused sessions count in the denominator"
              description="When enabled, excused absences lower the attendance percentage."
              checked={form.excusedCountsInDenominator}
              disabled={!editable}
              onChange={(checked) => update('excusedCountsInDenominator', checked)}
            />
            <Field label="Attendance threshold (%)" hint="Used for at-risk reporting and certificate eligibility.">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.attendanceThresholdPercent}
                onChange={(event) => update('attendanceThresholdPercent', Number(event.target.value))}
                disabled={!editable}
                className="max-w-[140px]"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Certificate policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CheckboxRow
              label="Require full payment"
              description="Block issuance while the enrollment has an outstanding balance."
              checked={form.certificateRequireFullPayment}
              disabled={!editable}
              onChange={(checked) => update('certificateRequireFullPayment', checked)}
            />
            <CheckboxRow
              label="Require attendance threshold"
              description="Require the attendance percentage to meet the threshold above."
              checked={form.certificateRequireAttendance}
              disabled={!editable}
              onChange={(checked) => update('certificateRequireAttendance', checked)}
            />
            <CheckboxRow
              label="Require assessments passed"
              description="Require a passing result for every published assessment of the course."
              checked={form.certificateRequireAssessmentsPassed}
              disabled={!editable}
              onChange={(checked) => update('certificateRequireAssessmentsPassed', checked)}
            />
            <CheckboxRow
              label="Show student name on public verification"
              description="When disabled, only the certificate status and course are shown publicly."
              checked={form.certificatePublicShowName}
              disabled={!editable}
              onChange={(checked) => update('certificatePublicShowName', checked)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Signatory name">
                <Input value={form.signatoryName ?? ''} onChange={(event) => update('signatoryName', event.target.value)} disabled={!editable} />
              </Field>
              <Field label="Signatory title">
                <Input value={form.signatoryTitle ?? ''} onChange={(event) => update('signatoryTitle', event.target.value)} disabled={!editable} />
              </Field>
              <Field label="Certificate legal text" className="sm:col-span-2">
                <Input value={form.certificateLegalText ?? ''} onChange={(event) => update('certificateLegalText', event.target.value)} disabled={!editable} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Numbering</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Receipt prefix" hint="2–10 uppercase letters.">
              <Input value={form.receiptPrefix} onChange={(event) => update('receiptPrefix', event.target.value.toUpperCase())} disabled={!editable} maxLength={10} />
            </Field>
            <Field label="Certificate prefix" hint="2–10 uppercase letters.">
              <Input value={form.certificatePrefix} onChange={(event) => update('certificatePrefix', event.target.value.toUpperCase())} disabled={!editable} maxLength={10} />
            </Field>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function CheckboxRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border p-3">
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => onChange(value === true)} className="mt-0.5" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
