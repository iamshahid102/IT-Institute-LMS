'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  ChevronDown,
  GraduationCap,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, formatApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';
import { useAuth } from '@/features/auth/auth-context';
import { ChangePasswordDialog } from '@/features/auth/change-password-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OfflineBanner } from './offline-banner';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { isActive, navFor, ROLE_LABELS, type NavGroup } from './navigation';

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-thin" aria-label="Main navigation">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                      active
                        ? 'bg-primary/20 font-medium text-white'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                    )}
                  >
                    <Icon className={cn('h-4 w-4', active ? 'text-[hsl(174_70%_70%)]' : 'text-slate-500')} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ variant, children }: { variant: 'admin' | 'front-desk' | 'student'; children: React.ReactNode }) {
  const { user, can, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const [passwordOpen, setPasswordOpen] = React.useState(false);

  const groups = React.useMemo(
    () =>
      navFor(variant)
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.permission || can(item.permission)),
        }))
        .filter((group) => group.items.length > 0),
    [variant, can],
  );

  const activeItem = groups.flatMap((group) => group.items).find((item) => isActive(pathname, item));

  const isStudent = variant === 'student';
  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      const result = await apiFetch<{ meta: { unread?: number } }>('/me/notifications?pageSize=1');
      return result.meta?.unread ?? 0;
    },
    enabled: isStudent,
    refetchInterval: 60_000,
  });

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch (error) {
      setSigningOut(false);
      throw error;
    }
  };

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-[hsl(200_25%_12%)] lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-white/5 px-4">
          <span className="rounded-lg bg-primary p-1.5 text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">IT Institute</p>
            <p className="truncate text-[11px] text-slate-400">Learning operations</p>
          </div>
        </div>
        <NavLinks groups={groups} />
        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/25 text-xs font-semibold text-white">
              {initials(user?.fullName ?? 'U')}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-100">{user?.fullName}</p>
              <p className="truncate text-[11px] text-slate-400">
                {user ? ROLE_LABELS[user.role] ?? user.role : ''}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{activeItem?.label ?? 'Workspace'}</p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {user ? ROLE_LABELS[user.role] ?? user.role : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="hidden gap-1 sm:inline-flex">
              <ShieldCheck className="h-3 w-3" />
              {user ? ROLE_LABELS[user.role] ?? user.role : ''}
            </Badge>
            {isStudent ? (
              <Button variant="ghost" size="icon" asChild aria-label="Notifications">
                <Link href="/student/notifications" className="relative">
                  <Bell className="h-4.5 w-4.5" />
                  {unread ? (
                    <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  ) : null}
                </Link>
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 px-1.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-accent-foreground">
                    {initials(user?.fullName ?? 'U')}
                  </span>
                  <span className="hidden max-w-32 truncate text-sm sm:block">{user?.fullName}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isStudent ? (
                  <DropdownMenuItem asChild>
                    <Link href="/student/profile">
                      <UserRound className="h-4 w-4" /> My profile
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    setPasswordOpen(true);
                  }}
                >
                  <ShieldCheck className="h-4 w-4" /> Change password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={signingOut}
                  onSelect={(event) => {
                    event.preventDefault();
                    void handleSignOut().catch((error) => {
                      toast.error(formatApiError(error));
                    });
                  }}
                >
                  <LogOut className="h-4 w-4" /> {signingOut ? 'Signing out…' : 'Sign out'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
          <OfflineBanner />
          <InstallPrompt />
          {children}
        </main>
      </div>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="left-0 top-0 h-dvh max-h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 gap-0 rounded-none border-r p-0 sm:left-0">
          <div className="flex h-16 items-center justify-between border-b px-4">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <GraduationCap className="h-5 w-5 text-primary" />
              IT Institute LMS
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto bg-[hsl(200_25%_12%)]">
            <NavLinks groups={groups} onNavigate={() => setMobileOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
