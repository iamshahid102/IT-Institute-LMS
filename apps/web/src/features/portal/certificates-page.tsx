'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Award, Download, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, downloadFile, formatApiError } from '@/lib/api';
import { dateLabel } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingSkeleton } from '@/components/ui/skeleton';

export interface CertificateRow {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  status: string;
  issuedAt: string;
  revokedAt: string | null;
  courseTitle: string;
  courseCode: string;
  batchCode: string;
}

export function usePortalCertificates() {
  return useQuery({
    queryKey: ['portal', 'certificates'],
    queryFn: async () => (await apiFetch<{ data: CertificateRow[] }>('/me/certificates')).data,
  });
}

export function PortalCertificatesPage() {
  const { data, isLoading, error, refetch } = usePortalCertificates();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Certificates"
        description="Digital certificates issued to you. Each has a public verification link."
        backHref="/student"
        backLabel="Dashboard"
      />

      {error ? (
        <ErrorState message="Your certificates could not be loaded." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No certificates yet"
          description="Certificates appear here once you complete a course and the institute issues one."
          icon={<Award className="h-5 w-5" />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data?.map((certificate) => (
            <Card key={certificate.id}>
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">{certificate.courseTitle}</CardTitle>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {certificate.certificateNumber} · {certificate.batchCode}
                  </p>
                </div>
                <StatusBadge status={certificate.status} />
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Issued {dateLabel(certificate.issuedAt)}
                  {certificate.revokedAt ? ` · revoked ${dateLabel(certificate.revokedAt)}` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {certificate.status === 'ISSUED' ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        void downloadFile(
                          `/me/certificates/${certificate.id}/download`,
                          `${certificate.certificateNumber}.pdf`,
                        ).catch((downloadError) => toast.error(formatApiError(downloadError)))
                      }
                    >
                      <Download className="h-3.5 w-3.5" /> Download PDF
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/verify-certificate/${certificate.verificationCode}`} target="_blank">
                      <ShieldCheck className="h-3.5 w-3.5" /> Verify
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/student/certificates/${certificate.id}`}>Details</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
