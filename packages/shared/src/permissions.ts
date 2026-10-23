import type { Role } from './types';
import { STAFF_ROLES } from './types';

/**
 * Central permission catalogue. The API is the security boundary; the web client
 * uses the same map only to hide actions that would be rejected anyway.
 */
export const PERMISSIONS = [
  'student.read',
  'student.create',
  'student.update',
  'student.archive',
  'course.read',
  'course.manage',
  'batch.read',
  'batch.manage',
  'instructor.read',
  'instructor.manage',
  'enrollment.read',
  'enrollment.manage',
  'attendance.read',
  'attendance.mark',
  'attendance.correct',
  'attendance.session.manage',
  'attendance.finalize',
  'fee.read',
  'fee.plan.manage',
  'fee.invoice.read',
  'fee.invoice.create',
  'fee.payment.receive',
  'fee.reverse',
  'assessment.read',
  'assessment.manage',
  'certificate.read',
  'certificate.issue',
  'certificate.revoke',
  'report.read',
  'report.financial.read',
  'announcement.read',
  'announcement.manage',
  'user.manage',
  'settings.read',
  'settings.manage',
  'audit.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const SUPER_ADMIN_PERMISSIONS: readonly Permission[] = PERMISSIONS;
const FRONT_DESK_PERMISSIONS: readonly Permission[] = [
  'student.read',
  'student.create',
  'student.update',
  'course.read',
  'batch.read',
  'instructor.read',
  'enrollment.read',
  'enrollment.manage',
  'attendance.read',
  'attendance.mark',
  'attendance.session.manage',
  'attendance.finalize',
  'fee.read',
  'fee.invoice.read',
  'fee.invoice.create',
  'fee.payment.receive',
  'assessment.read',
  'certificate.read',
  'report.read',
  'announcement.read',
  'settings.read',
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: SUPER_ADMIN_PERMISSIONS,
  FRONT_DESK: FRONT_DESK_PERMISSIONS,
  STUDENT: [],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isStaffRole(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function permissionsForRole(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}
