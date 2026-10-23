'use client';

import Link from 'next/link';
import { Award, Download, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { downloadFile, formatApiError } from '@/lib/api';
import { dateLabel } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';
import { usePortalCertificates } from './certificates-page';

export function PortalCertificateDetail({ certificateId }: { certificateId: string }) {
  const { data, isLoading, error, refetch } = usePortalCertificates();
  const certificate = data?.find((item) => item.id === certificateId);

  if (isLoading) return <LoadingSkeleton rows={3} />;
  if (error) return <ErrorState message="This certificate could not be loaded." onRetry={() => void refetch()} />;
  if (!certificate) {
    return (
      <EmptyState
        title="Certificate not found"
        description="This certificate does not belong to your account or is no longer available."
        icon={<Award className="h-5 w-5" />}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/student/certificates">All certificates</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={certificate.courseTitle}
        description={`${certificate.certificateNumber} · issued ${dateLabel(certificate.issuedAt)}`}
        backHref="/student/certificates"
        backLabel="Certificates"
        actions={<StatusBadge status={certificate.status} />}
      />

      <Card className="mx-auto max-w-2xl">
        <CardContent className="space-y-5 p-8 text-center">
          <Award className="mx-auto h-12 w-12 text-primary" />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Certificate of completion</p>
            <h2 className="mt-2 text-xl font-semibold">{certificate.courseTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {certificate.courseCode} · Batch {certificate.batchCode}
            </p>
          </div>
          <dl className="grid gap-3 text-left text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Certificate number</dt>
              <dd className="font-mono">{certificate.certificateNumber}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Issued</dt>
              <dd>{dateLabel(certificate.issuedAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Verification code</dt>
              <dd className="break-all font-mono text-xs">{certificate.verificationCode}</dd>
            </div>
          </dl>
          {certificate.status !== 'ISSUED' ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              This certificate has been revoked and cannot be downloaded. Contact the institute for details.
            </p>
          ) : null}
          <div className="flex flex-wrap justify-center gap-2">
            {certificate.status === 'ISSUED' ? (
              <Button
                onClick={() =>
                  void downloadFile(
                    `/me/certificates/${certificate.id}/download`,
                    `${certificate.certificateNumber}.pdf`,
                  ).catch((downloadError) => toast.error(formatApiError(downloadError)))
                }
              >
                <Download className="h-4 w-4" /> Download PDF
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link href={`/verify-certificate/${certificate.verificationCode}`} target="_blank">
                <ShieldCheck className="h-4 w-4" /> Public verification
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
