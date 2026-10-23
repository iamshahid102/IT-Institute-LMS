import { Suspense } from 'react';
import { SessionsPage } from '@/features/attendance/sessions-page';
import { LoadingSkeleton } from '@/components/ui/skeleton';

export default function AdminSessionsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={5} />}>
      <SessionsPage mode="admin" />
    </Suspense>
  );
}
