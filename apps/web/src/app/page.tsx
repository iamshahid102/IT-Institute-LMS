'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  FileBadge,
  GraduationCap,
  QrCode,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { homeForRole, useAuth } from '@/features/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const FEATURES = [
  {
    icon: CalendarCheck,
    title: 'Attendance that holds up',
    description: 'QR and student-number marking, duplicate protection, finalized-session policy and audited corrections.',
  },
  {
    icon: Wallet,
    title: 'Fee ledger you can reconcile',
    description: 'Installment invoices, partial payments, receipts, outstanding balances and traceable reversals.',
  },
  {
    icon: FileBadge,
    title: 'Certificates with verification',
    description: 'Eligibility checks, private PDF storage, authenticated downloads and a public status page.',
  },
  {
    icon: ShieldCheck,
    title: 'Student data stays scoped',
    description: 'Every student request is resolved from the session identity — never from a client-supplied ID.',
  },
];

export default function LandingPage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="rounded-lg bg-primary p-1.5 text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">IT Institute LMS</p>
              <p className="text-[11px] text-muted-foreground">Operations &amp; learning portal</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/verify-certificate">Verify certificate</Link>
            </Button>
            {isLoading ? (
              <span className="h-9 w-24 animate-pulse rounded-md bg-muted" />
            ) : user ? (
              <Button size="sm" asChild>
                <Link href={homeForRole(user.role)}>Open dashboard</Link>
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="border-b bg-gradient-to-b from-primary-soft/60 to-background">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Role-based access enforced by the API
              </span>
              <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Run the institute from one dependable system.
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
                Admissions, batches, schedules, attendance, fee collection and certificate issuance — with a
                student portal that reveals only a student&apos;s own records.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link href="/login">
                    Sign in to your account <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/verify-certificate">
                    <BadgeCheck className="h-4 w-4" /> Verify a certificate
                  </Link>
                </Button>
              </div>
              <dl className="grid max-w-lg grid-cols-3 gap-4 border-t pt-6 text-sm">
                <div>
                  <dt className="text-muted-foreground">Roles</dt>
                  <dd className="font-medium">Admin · Front Desk · Student</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Installable</dt>
                  <dd className="font-medium">Works on phone &amp; desktop</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Audited</dt>
                  <dd className="font-medium">Sensitive actions logged</dd>
                </div>
              </dl>
            </div>

            <Card className="self-center p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Student portal</p>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                  <div>
                    <p className="text-sm font-medium">Web Development — Morning A</p>
                    <p className="text-xs text-muted-foreground">Mon · Wed · Fri, 9:00 AM – 12:00 PM</p>
                  </div>
                  <QrCode className="h-8 w-8 text-primary" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Attendance</p>
                    <p className="text-xl font-semibold">92.5%</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className="text-xl font-semibold">PKR 30,000</p>
                  </div>
                </div>
                <p className="rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground">
                  Illustrative layout. Live figures come from the institute database after sign-in.
                </p>
              </div>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="p-6">
                <span className="inline-flex rounded-lg bg-primary-soft p-2.5 text-accent-foreground">
                  <feature.icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-base font-semibold">{feature.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} IT Institute. Authorised use only.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/verify-certificate" className="hover:text-foreground">
              Certificate verification
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
