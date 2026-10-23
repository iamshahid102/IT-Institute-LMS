'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, BadgeCheck, CalendarDays, GraduationCap, ShieldCheck } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { dateLabel } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

interface CertificateVerification {
  certificateNumber: string;
  status: 'ISSUED' | 'REVOKED';
  courseTitle: string;
  courseCode: string;
  issuedAt: string;
  revokedAt: string | null;
  studentName?: string;
  instituteName: string;
}

export function VerifyCertificateResult({ code }: { code: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['verify-certificate', code],
    queryFn: async () => {
      const result = await apiFetch<{ data: CertificateVerification }>(
        `/public/certificates/verify/${encodeURIComponent(code)}`,
      );
      return result.data;
    },
    retry: false,
  });

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">Certificate verification</span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/verify-certificate">
              <ArrowLeft className="h-4 w-4" /> Another code
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
        {isLoading ? (
          <Card>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ) : error ? (
          error instanceof ApiError && error.status === 404 ? (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                  <AlertTriangle className="h-5 w-5" /> Certificate not found
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  No certificate matches this verification code. Check that the code was entered exactly as
                  printed, then try again.
                </p>
                <Button variant="outline" onClick={() => void refetch()}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ErrorState
              title="Verification unavailable"
              message="The verification service could not be reached. Please try again shortly."
              onRetry={() => void refetch()}
            />
          )
        ) : data ? (
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{data.instituteName}</p>
                  <CardTitle className="mt-1 text-xl">Certificate verification</CardTitle>
                </div>
                <Badge variant={data.status === 'ISSUED' ? 'success' : 'danger'} className="mt-1">
                  {data.status === 'ISSUED' ? 'Valid · Issued' : 'Revoked · Not valid'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              {data.status === 'REVOKED' ? (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    This certificate has been revoked by the institute. It must not be presented as valid.
                    {data.revokedAt ? ` Revoked on ${dateLabel(data.revokedAt)}.` : ''}
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-success/20 bg-[hsl(152_45%_95%)] p-3 text-sm text-[hsl(152_65%_24%)]">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>This certificate was issued by the institute and is currently valid.</p>
                </div>
              )}

              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Certificate number</dt>
                  <dd className="text-sm font-medium">{data.certificateNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Issue date</dt>
                  <dd className="flex items-center gap-1.5 text-sm font-medium">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    {dateLabel(data.issuedAt)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Programme</dt>
                  <dd className="flex items-center gap-1.5 text-sm font-medium">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    {data.courseTitle} <span className="text-muted-foreground">({data.courseCode})</span>
                  </dd>
                </div>
                {data.studentName ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Awarded to</dt>
                    <dd className="text-sm font-medium">{data.studentName}</dd>
                  </div>
                ) : null}
              </dl>

              <p className="border-t pt-4 text-xs text-muted-foreground">
                Only approved verification fields are shown. Contact the institute if these details do not match
                the document you were given.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
