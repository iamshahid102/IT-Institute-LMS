'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, formatApiError } from '@/lib/api';
import { homeForRole, useAuth } from '@/features/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormErrorSummary } from '@/components/ui/form-field';

const schema = z.object({
  email: z.string().min(1, 'Enter your email.').pipe(z.email('Enter a valid email address.')),
  password: z.string().min(1, 'Enter your password.'),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  React.useEffect(() => {
    void apiFetch('/auth/csrf').catch(() => undefined);
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const user = await login(values.email, values.password);
      toast.success(`Welcome back, ${user.fullName.split(' ')[0]}`);
      const requested = searchParams.get('next');
      const safeNext =
        requested && requested.startsWith('/') && !requested.startsWith('//') ? requested : homeForRole(user.role);
      router.replace(safeNext);
    } catch (submitError) {
      setError(formatApiError(submitError));
      form.setValue('password', '');
    }
  });

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center lg:text-left">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-accent-foreground lg:hidden">
          <LockKeyhole className="h-3 w-3" /> Secure institute access
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use the account issued by your institute administrator.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormErrorSummary message={error} />
        <FormField label="Email address" htmlFor="email" error={form.formState.errors.email?.message} required>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@institute.edu"
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register('email')}
          />
        </FormField>
        <FormField label="Password" htmlFor="password" error={form.formState.errors.password?.message} required>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register('password')}
          />
        </FormField>
        <div className="flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Public registration is disabled. Students receive portal credentials from the institute.
      </p>
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/verify-certificate" className="text-primary underline-offset-4 hover:underline">
          Verify a certificate
        </Link>
      </p>
    </div>
  );
}
