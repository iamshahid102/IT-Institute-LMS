'use client';

import { useParams } from 'next/navigation';
import { EnrollmentDetail } from '@/features/enrollments/enrollment-detail';

export default function FrontDeskEnrollmentDetailPage() {
  const params = useParams<{ id: string }>();
  return <EnrollmentDetail enrollmentId={params.id} mode="front-desk" />;
}
