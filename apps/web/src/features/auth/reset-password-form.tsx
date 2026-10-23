'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { apiFetch, formatApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';

const schema = z
  .object({
    password: z
      .string()
      .min(10, 'Use at least 10 characters.')
      .regex(/[A-Za-z]/, 'Include at least one letter.')
      .regex(/\d/, 'Include at least one number.'),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password: values.password }),
      });
      setDone(true);
    } catch (submitError) {
      setError(formatApiError(submitError));
    }
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>This link can be used once and expires one hour after it was issued.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!token ? (
          <div className="space-y-3">
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              This reset link is missing its token. Ask the institute administrator for a new link.
            </p>
            <Link href="/login" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        ) : done ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-success/20 bg-[hsl(152_45%_95%)] p-3 text-sm text-[hsl(152_65%_24%)]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Your password has been reset. All previous sessions were signed out.</p>
            </div>
            <Button asChild className="w-full">
              <Link href="/login">Continue to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormErrorSummary message={error} />
            <FormField label="New password" htmlFor="password" error={form.formState.errors.password?.message} required>
              <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
            </FormField>
            <FormField
              label="Confirm password"
              htmlFor="confirmPassword"
              error={form.formState.errors.confirmPassword?.message}
              required
            >
              <Input id="confirmPassword" type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
            </FormField>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Resetting…' : 'Reset password'}
            </Button>
            <Link href="/login" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
