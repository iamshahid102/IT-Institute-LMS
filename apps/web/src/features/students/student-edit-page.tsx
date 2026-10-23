'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/empty-state';
import { StudentForm } from './student-form';

interface StudentEditData {
  id: string;
  fullName: string;
  guardianName: string | null;
  phone: string;
  email: string | null;
  dateOfBirth: string | null;
  admissionDate: string;
  address: string | null;
  notes: string | null;
  status: string;
}

export function StudentEditPage({ studentId, basePath }: { studentId: string; basePath: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['student', studentId, 'edit'],
    queryFn: async () => {
      const result = await apiFetch<{ data: StudentEditData }>(`/students/${studentId}`);
      return result.data;
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState message="The student record could not be loaded." onRetry={() => void refetch()} />;
  }

  return <StudentForm mode="edit" basePath={basePath} studentId={studentId} initial={data} />;
}
