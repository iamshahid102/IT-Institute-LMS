import { AppShell } from '@/components/layout/app-shell';
import { RequireAuth } from '@/features/auth/auth-context';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth roles={['SUPER_ADMIN']}>
      <AppShell variant="admin">{children}</AppShell>
    </RequireAuth>
  );
}
