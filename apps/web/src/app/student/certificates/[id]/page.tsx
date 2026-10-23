'use client';

import { useParams } from 'next/navigation';
import { PortalCertificateDetail } from '@/features/portal/certificate-detail';

export default function StudentCertificateDetailPage() {
  const params = useParams<{ id: string }>();
  return <PortalCertificateDetail certificateId={params.id} />;
}
