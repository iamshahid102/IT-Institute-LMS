import { AppShell } from '@/components/layout/app-shell';
import { RequireAuth } from '@/features/auth/auth-context';

export default function FrontDeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth roles={['FRONT_DESK']}>
      <AppShell variant="front-desk">{children}</AppShell>
    </RequireAuth>
  );
}
