'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { qs } from '@/lib/query';

export interface CourseOption {
  id: string;
  code: string;
  title: string;
  status: string;
  defaultFeeMinor: number | null;
  durationValue: number;
  durationUnit: string;
}

export interface BatchOption {
  id: string;
  code: string;
  name: string;
  status: string;
  capacity: number;
  enrolledCount: number;
  course: { id: string; code: string; title: string; defaultFeeMinor?: number | null };
  schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string; room: string | null }>;
}

export interface StudentOption {
  id: string;
  studentNumber: string;
  fullName: string;
  phone: string;
  status: string;
}

export interface EnrollmentOption {
  id: string;
  status: string;
  agreedFeeMinor: number;
  currency: string;
  student: StudentOption;
  batch: BatchOption & { course: { title: string; code: string }; instructor: { fullName: string } | null };
}

export function useCourses(options: { includeAll?: boolean } = {}) {
  return useQuery({
    queryKey: ['options', 'courses', options.includeAll ?? false],
    queryFn: async () => {
      const result = await apiFetch<{ data: CourseOption[] }>(
        `/courses${qs({ pageSize: 100, ...(options.includeAll ? {} : { status: 'ACTIVE' }) })}`,
      );
      return result.data;
    },
    staleTime: 60_000,
  });
}

export function useBatches(courseId?: string) {
  return useQuery({
    queryKey: ['options', 'batches', courseId ?? 'all'],
    queryFn: async () => {
      const result = await apiFetch<{ data: BatchOption[] }>(`/batches${qs({ pageSize: 100, courseId })}`);
      return result.data;
    },
    staleTime: 30_000,
  });
}

export function useInstructors() {
  return useQuery({
    queryKey: ['options', 'instructors'],
    queryFn: async () => {
      const result = await apiFetch<{ data: Array<{ id: string; fullName: string; active: boolean }> }>(
        `/instructors${qs({ pageSize: 100 })}`,
      );
      return result.data;
    },
    staleTime: 60_000,
  });
}

export function useStudentSearch(search: string) {
  return useQuery({
    queryKey: ['options', 'students', search],
    queryFn: async () => {
      const result = await apiFetch<{ data: StudentOption[] }>(`/students${qs({ pageSize: 20, search })}`);
      return result.data;
    },
    staleTime: 15_000,
  });
}

export function useEnrollmentSearch(search: string) {
  return useQuery({
    queryKey: ['options', 'enrollments', search],
    queryFn: async () => {
      const result = await apiFetch<{ data: EnrollmentOption[] }>(`/enrollments${qs({ pageSize: 25, search })}`);
      return result.data;
    },
    staleTime: 15_000,
  });
}
