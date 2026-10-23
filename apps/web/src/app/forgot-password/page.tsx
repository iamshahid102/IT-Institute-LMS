'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { apiFetch, formatApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';

const schema = z.object({
  email: z.string().min(1, 'Enter your email address.').pipe(z.email('Enter a valid email address.')),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: values.email }),
      });
      setSent(true);
    } catch (submitError) {
      setError(formatApiError(submitError));
    }
  });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription>
            Enter the email address on your institute account. If it matches a record, we will send reset
            instructions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sent ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-success/20 bg-[hsl(152_45%_95%)] p-3 text-sm text-[hsl(152_65%_24%)]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  If an account matches that address, reset instructions have been issued. The response is the
                  same whether or not the account exists.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                No email? Ask the institute administrator for a one-time reset link from the staff accounts
                screen.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <FormErrorSummary message={error} />
              <FormField label="Email address" htmlFor="email" error={form.formState.errors.email?.message} required>
                <Input id="email" type="email" autoComplete="username" {...form.register('email')} />
              </FormField>
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Requesting…' : 'Request reset'}
              </Button>
            </form>
          )}
          <Link href="/login" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
