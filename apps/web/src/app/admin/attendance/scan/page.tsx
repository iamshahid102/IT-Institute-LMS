import { Suspense } from 'react';
import { AttendanceScanner } from '@/features/attendance/scanner';
import { LoadingSkeleton } from '@/components/ui/skeleton';

export default function AdminScannerPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={4} />}>
      <AttendanceScanner mode="admin" />
    </Suspense>
  );
}
