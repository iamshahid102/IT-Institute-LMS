'use client';

import { useParams } from 'next/navigation';
import { StudentDetail } from '@/features/students/student-detail';

export default function AdminStudentDetailPage() {
  const params = useParams<{ id: string }>();
  return <StudentDetail studentId={params.id} mode="admin" />;
}
