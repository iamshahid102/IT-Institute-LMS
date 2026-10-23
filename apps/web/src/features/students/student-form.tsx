'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { apiFetch, formatApiError } from '@/lib/api';
import { localDateInput } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const baseSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the student name.').max(120),
  guardianName: z.string().trim().max(120).optional(),
  phone: z.string().trim().min(7, 'Enter a contact number.').max(30),
  email: z.union([z.literal(''), z.email('Enter a valid email address.')]).optional(),
  dateOfBirth: z.string().optional(),
  admissionDate: z.string().min(1, 'Select the admission date.'),
  address: z.string().trim().max(240).optional(),
  notes: z.string().trim().max(1000).optional(),
  createAccount: z.boolean().optional(),
  portalPassword: z.string().optional(),
});

const schema = baseSchema
  .extend({
    status: z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'WITHDRAWN']).optional(),
  })
  .superRefine((values, ctx) => {
  if (values.createAccount) {
    if (!values.email) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'An email is required for a portal account.' });
    }
    if (!values.portalPassword || values.portalPassword.length < 10) {
      ctx.addIssue({
        code: 'custom',
        path: ['portalPassword'],
        message: 'Use at least 10 characters for the portal password.',
      });
    } else {
      if (!/[A-Za-z]/.test(values.portalPassword)) {
        ctx.addIssue({ code: 'custom', path: ['portalPassword'], message: 'Include at least one letter.' });
      }
      if (!/\d/.test(values.portalPassword)) {
        ctx.addIssue({ code: 'custom', path: ['portalPassword'], message: 'Include at least one number.' });
      }
    }
  }
});

type FormValues = z.infer<typeof schema>;

interface StudentFormProps {
  mode: 'create' | 'edit';
  basePath: string;
  studentId?: string;
  initial?: {
    fullName: string;
    guardianName: string | null;
    phone: string;
    email: string | null;
    dateOfBirth: string | null;
    admissionDate: string;
    address: string | null;
    notes: string | null;
    status: string;
  };
}

export function StudentForm({ mode, basePath, studentId, initial }: StudentFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: initial?.fullName ?? '',
      guardianName: initial?.guardianName ?? '',
      phone: initial?.phone ?? '',
      email: initial?.email ?? '',
      dateOfBirth: initial?.dateOfBirth?.slice(0, 10) ?? '',
      admissionDate: initial?.admissionDate?.slice(0, 10) ?? localDateInput(),
      address: initial?.address ?? '',
      notes: initial?.notes ?? '',
      createAccount: false,
      portalPassword: '',
      ...(mode === 'edit' ? { status: (initial?.status as FormValues['status']) ?? 'ACTIVE' } : {}),
    },
  });

  const createAccount = form.watch('createAccount');

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (mode === 'create') {
        const payload = {
          fullName: values.fullName,
          guardianName: values.guardianName || undefined,
          phone: values.phone,
          email: values.email || undefined,
          dateOfBirth: values.dateOfBirth || undefined,
          admissionDate: values.admissionDate,
          address: values.address || undefined,
          notes: values.notes || undefined,
          ...(values.createAccount
            ? { portalPassword: values.portalPassword, email: values.email }
            : {}),
        };
        const result = await apiFetch<{ data: { id: string; studentNumber: string } }>('/students', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success(`Student admitted as ${result.data.studentNumber}.`);
        queryClient.invalidateQueries({ queryKey: ['students'] });
        router.push(`${basePath}/students/${result.data.id}`);
      } else {
        await apiFetch(`/students/${studentId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            fullName: values.fullName,
            guardianName: values.guardianName || null,
            phone: values.phone,
            email: values.email || undefined,
            dateOfBirth: values.dateOfBirth || undefined,
            address: values.address || null,
            notes: values.notes || null,
            status: values.status ?? initial?.status ?? 'ACTIVE',
          }),
        });
        toast.success('Student record updated.');
        queryClient.invalidateQueries({ queryKey: ['students'] });
        queryClient.invalidateQueries({ queryKey: ['student', studentId] });
        router.push(`${basePath}/students/${studentId}`);
      }
    } catch (error) {
      setServerError(formatApiError(error));
    }
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={mode === 'create' ? 'New admission' : 'Edit student'}
        description={
          mode === 'create'
            ? 'Create the student record. A unique student number is generated automatically.'
            : 'Update permitted student details. Financial and academic history is preserved.'
        }
        backHref={mode === 'create' ? `${basePath}/students` : `${basePath}/students/${studentId}`}
      />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormErrorSummary message={serverError} />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Student details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" htmlFor="fullName" error={form.formState.errors.fullName?.message} required>
              <Input id="fullName" {...form.register('fullName')} autoComplete="name" />
            </FormField>
            <FormField label="Guardian name" htmlFor="guardianName" error={form.formState.errors.guardianName?.message}>
              <Input id="guardianName" {...form.register('guardianName')} />
            </FormField>
            <FormField label="Phone" htmlFor="phone" error={form.formState.errors.phone?.message} required>
              <Input id="phone" {...form.register('phone')} inputMode="tel" autoComplete="tel" />
            </FormField>
            <FormField label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
              <Input id="email" type="email" {...form.register('email')} autoComplete="email" />
            </FormField>
            <FormField label="Date of birth" htmlFor="dateOfBirth" error={form.formState.errors.dateOfBirth?.message}>
              <Input id="dateOfBirth" type="date" {...form.register('dateOfBirth')} />
            </FormField>
            <FormField
              label="Admission date"
              htmlFor="admissionDate"
              error={form.formState.errors.admissionDate?.message}
              required
            >
              <Input id="admissionDate" type="date" {...form.register('admissionDate')} disabled={mode === 'edit'} />
            </FormField>
            <FormField
              label="Address"
              htmlFor="address"
              error={form.formState.errors.address?.message}
              className="sm:col-span-2"
            >
              <Input id="address" {...form.register('address')} />
            </FormField>
            {mode === 'edit' ? (
              <FormField label="Record status" htmlFor="status" error={form.formState.errors.status?.message}>
                <Select
                  value={form.watch('status')}
                  onValueChange={(value) => form.setValue('status', value as FormValues['status'])}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="GRADUATED">Graduated</SelectItem>
                    <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            ) : null}
            <FormField label="Notes" htmlFor="notes" error={form.formState.errors.notes?.message} className="sm:col-span-2">
              <Textarea id="notes" rows={3} {...form.register('notes')} />
            </FormField>
          </CardContent>
        </Card>

        {mode === 'create' ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Student portal account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label htmlFor="createAccount" className="flex items-start gap-2 text-sm">
                <Checkbox
                  id="createAccount"
                  checked={createAccount}
                  onCheckedChange={(checked) => form.setValue('createAccount', checked === true)}
                />
                <span>
                  Create a portal account now
                  <span className="block text-xs text-muted-foreground">
                    The student signs in with their email. This requires an email address and a temporary password.
                  </span>
                </span>
              </label>
              {createAccount ? (
                <FormField
                  label="Temporary password"
                  htmlFor="portalPassword"
                  error={form.formState.errors.portalPassword?.message}
                  hint="At least 10 characters with a letter and a number. Ask the student to change it after first sign-in."
                  required
                >
                  <Input id="portalPassword" type="text" autoComplete="new-password" {...form.register('portalPassword')} />
                </FormField>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            <Save className="h-4 w-4" />
            {form.formState.isSubmitting ? 'Saving…' : mode === 'create' ? 'Admit student' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
