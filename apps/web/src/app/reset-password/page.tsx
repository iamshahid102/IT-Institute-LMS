import { Suspense } from 'react';
import { ResetPasswordForm } from '@/features/auth/reset-password-form';

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <Suspense fallback={<div className="h-56 w-full max-w-md animate-pulse rounded-xl bg-muted" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
