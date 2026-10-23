'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, formatApiError } from '@/lib/api';
import { dateLabel, dateTimeLabel } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';

interface Profile {
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
  lastLoginAt: string | null;
}

const schema = z.object({
  phone: z.string().trim().min(7, 'Enter a valid phone number.').max(30),
  address: z.string().trim().max(240).optional(),
});

type FormValues = z.infer<typeof schema>;

export function PortalProfilePage() {
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);

  const { data, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['portal', 'profile'],
    queryFn: async () => (await apiFetch<{ data: Profile }>('/me/profile')).data,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '', address: '' },
  });

  React.useEffect(() => {
    if (data) form.reset({ phone: data.phone, address: data.address ?? '' });
  }, [data, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await apiFetch('/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({ phone: values.phone, address: values.address ?? '' }),
      });
      toast.success('Profile updated.');
      queryClient.invalidateQueries({ queryKey: ['portal', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['portal', 'overview'] });
    } catch (updateError) {
      setError(formatApiError(updateError));
    }
  });

  if (isLoading) return <LoadingSkeleton rows={4} />;
  if (loadError || !data) return <ErrorState message="Your profile could not be loaded." onRetry={() => void refetch()} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="My profile"
        description="Contact details can be updated here. Academic and financial fields are managed by staff."
        backHref="/student"
        backLabel="Dashboard"
        actions={<StatusBadge status={data.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Editable details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <FormErrorSummary message={error} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Phone" error={form.formState.errors.phone?.message} required>
                  <Input {...form.register('phone')} autoComplete="tel" />
                </FormField>
                <FormField label="Address" error={form.formState.errors.address?.message}>
                  <Input {...form.register('address')} autoComplete="street-address" />
                </FormField>
              </div>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                <Save className="h-4 w-4" /> {form.formState.isSubmitting ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ['Full name', data.fullName],
              ['Student number', data.studentNumber],
              ['Guardian', data.guardianName ?? '—'],
              ['Email', data.email ?? '—'],
              ['Date of birth', data.dateOfBirth ? dateLabel(data.dateOfBirth) : '—'],
              ['Admitted', dateLabel(data.admissionDate)],
              ['Last login', data.lastLoginAt ? dateTimeLabel(data.lastLoginAt) : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-right font-medium">{value}</span>
              </div>
            ))}
            <p className="border-t pt-2 text-xs text-muted-foreground">
              To correct your name or other academic details, contact the front desk.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
