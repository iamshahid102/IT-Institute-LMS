import { AppShell } from '@/components/layout/app-shell';
import { RequireAuth } from '@/features/auth/auth-context';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth roles={['STUDENT']}>
      <AppShell variant="student">{children}</AppShell>
    </RequireAuth>
  );
}
