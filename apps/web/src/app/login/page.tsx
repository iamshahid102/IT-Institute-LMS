import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-[hsl(200_25%_12%)] lg:grid lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 text-slate-100 lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
              <path d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M7 11.5V16c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4.5" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold">IT Institute LMS</p>
            <p className="text-xs text-slate-400">Institute operations &amp; learning portal</p>
          </div>
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold leading-tight text-balance">
            One secure workspace for admissions, attendance, fees and certificates.
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Staff manage daily institute operations. Students see only their own courses, attendance, fee
            ledger and certificates — enforced by the API on every request.
          </p>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• QR and manual attendance with duplicate protection</li>
            <li>• Installment invoices, receipts and auditable reversals</li>
            <li>• Verifiable PDF certificates with private storage</li>
          </ul>
        </div>
        <p className="text-xs text-slate-500">
          Authorised access only. Activity is audited. If you need an account, contact the institute
          administrator.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background px-5 py-10 sm:px-10">
        <Suspense fallback={<div className="h-40 w-full max-w-sm animate-pulse rounded-xl bg-muted" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
