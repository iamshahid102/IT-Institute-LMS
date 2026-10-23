'use client';

import { useParams } from 'next/navigation';
import { StudentEditPage } from '@/features/students/student-edit-page';

export default function FrontDeskEditStudentPage() {
  const params = useParams<{ id: string }>();
  return <StudentEditPage studentId={params.id} basePath="/front-desk" />;
}
