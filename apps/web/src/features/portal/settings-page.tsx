'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bell, KeyRound } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChangePasswordDialog } from '@/features/auth/change-password-dialog';

export function PortalSettingsPage() {
  const { data } = useQuery({
    queryKey: ['portal', 'profile'],
    queryFn: async () => (await apiFetch<{ data: { email: string | null; studentNumber: string } }>('/me/profile')).data,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Account settings"
        description="Manage your password and notifications."
        backHref="/student"
        backLabel="Dashboard"
      />

      <div className="grid max-w-3xl gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" /> Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Signed in as {data?.email ?? data?.studentNumber ?? 'your student account'}. Changing your password signs out
              every other session.
            </p>
            <ChangePasswordDialog
              trigger={
                <Button size="sm" variant="outline">
                  Change password
                </Button>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" /> Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Announcements and account updates appear in your in-app notification feed.
            </p>
            <Button size="sm" variant="outline" asChild>
              <Link href="/student/notifications">View notifications</Link>
            </Button>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Sessions expire automatically. If you suspect unauthorised access, change your password immediately and inform the
          institute.
        </p>
      </div>
    </div>
  );
}
