'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@lms/shared';
import { ApiError, apiFetch } from '@/lib/api';
import { FullPageLoading } from '@/components/layout/full-page-loading';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: string;
  studentId?: string;
  permissions: string[];
}

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function homeForRole(role: Role): string {
  if (role === 'SUPER_ADMIN') return '/admin';
  if (role === 'FRONT_DESK') return '/front-desk';
  return '/student';
}

async function fetchCurrentUser(): Promise<SessionUser | null> {
  try {
    const result = await apiFetch<{ data: { user: SessionUser } }>('/auth/me');
    return result.data.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const login = React.useCallback(
    async (email: string, password: string) => {
      const result = await apiFetch<{ data: { user: SessionUser } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      queryClient.setQueryData(['auth', 'me'], result.data.user);
      queryClient.invalidateQueries();
      return result.data.user;
    },
    [queryClient],
  );

  const logout = React.useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      queryClient.clear();
      queryClient.setQueryData(['auth', 'me'], null);
      if ('caches' in window) {
        await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
      }
      router.replace('/login');
    }
  }, [queryClient, router]);

  const can = React.useCallback(
    (permission: string) => Boolean(data?.permissions?.includes(permission)),
    [data],
  );

  const refresh = React.useCallback(async () => {
    await refetch();
  }, [refetch]);

  const value = React.useMemo<AuthContextValue>(
    () => ({ user: data ?? null, isLoading, login, logout, can, refresh }),
    [data, isLoading, login, logout, can, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function RequireAuth({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!roles.includes(user.role)) {
      router.replace(homeForRole(user.role));
    }
  }, [isLoading, router, pathname, roles, user]);

  if (isLoading || !user || !roles.includes(user.role)) {
    return <FullPageLoading />;
  }

  return <>{children}</>;
}
