import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileBadge,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  QrCode,
  Receipt,
  ScanLine,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true }],
  },
  {
    label: 'Admissions',
    items: [
      { href: '/admin/students', label: 'Students', icon: Users, permission: 'student.read' },
      { href: '/admin/enrollments', label: 'Enrollments', icon: ClipboardList, permission: 'enrollment.read' },
    ],
  },
  {
    label: 'Academics',
    items: [
      { href: '/admin/courses', label: 'Courses', icon: BookOpen, permission: 'course.read' },
      { href: '/admin/batches', label: 'Batches', icon: GraduationCap, permission: 'batch.read' },
      { href: '/admin/instructors', label: 'Instructors', icon: Users, permission: 'instructor.read' },
      { href: '/admin/schedules', label: 'Schedules', icon: CalendarDays, permission: 'batch.read' },
    ],
  },
  {
    label: 'Attendance',
    items: [
      { href: '/admin/attendance', label: 'Sessions', icon: ClipboardCheck, permission: 'attendance.read' },
      { href: '/admin/attendance/scan', label: 'Scanner', icon: ScanLine, permission: 'attendance.mark' },
      { href: '/admin/attendance/reports', label: 'Attendance reports', icon: BarChart3, permission: 'attendance.read' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/admin/fees', label: 'Invoices', icon: FileText, permission: 'fee.invoice.read' },
      { href: '/admin/fees/structures', label: 'Fee plans', icon: Wallet, permission: 'fee.read' },
      { href: '/admin/fees/payments', label: 'Payments', icon: CreditCard, permission: 'fee.invoice.read' },
      { href: '/admin/fees/dues', label: 'Outstanding dues', icon: Receipt, permission: 'fee.invoice.read' },
      { href: '/admin/fees/receipts', label: 'Receipts', icon: Receipt, permission: 'fee.invoice.read' },
    ],
  },
  {
    label: 'Records',
    items: [
      { href: '/admin/assessments', label: 'Assessments', icon: ClipboardList, permission: 'assessment.read' },
      { href: '/admin/certificates', label: 'Certificates', icon: FileBadge, permission: 'certificate.read' },
      { href: '/admin/announcements', label: 'Announcements', icon: Megaphone, permission: 'announcement.read' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/admin/reports', label: 'Reports', icon: BarChart3, permission: 'report.read' },
      { href: '/admin/users', label: 'Staff accounts', icon: ShieldCheck, permission: 'user.manage' },
      { href: '/admin/audit-logs', label: 'Audit log', icon: ShieldCheck, permission: 'audit.read' },
      { href: '/admin/settings', label: 'Institute settings', icon: Settings, permission: 'settings.read' },
    ],
  },
];

export const FRONT_DESK_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/front-desk', label: 'Dashboard', icon: LayoutDashboard, exact: true }],
  },
  {
    label: 'Admissions',
    items: [
      { href: '/front-desk/students', label: 'Students', icon: Users, permission: 'student.read' },
      { href: '/front-desk/students/new', label: 'New admission', icon: UserPlus, permission: 'student.create' },
      { href: '/front-desk/enrollments', label: 'Enrollments', icon: ClipboardList, permission: 'enrollment.read' },
    ],
  },
  {
    label: 'Attendance',
    items: [
      { href: '/front-desk/attendance', label: 'Sessions', icon: ClipboardCheck, permission: 'attendance.read' },
      { href: '/front-desk/attendance/scan', label: 'Scan QR', icon: QrCode, permission: 'attendance.mark' },
      { href: '/front-desk/attendance/manual', label: 'Manual entry', icon: ClipboardList, permission: 'attendance.mark' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/front-desk/fees/collect', label: 'Collect payment', icon: CreditCard, permission: 'fee.payment.receive' },
      { href: '/front-desk/fees', label: 'Invoices & dues', icon: Receipt, permission: 'fee.invoice.read' },
      { href: '/front-desk/fees/receipts', label: 'Receipts', icon: Receipt, permission: 'fee.invoice.read' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/front-desk/announcements', label: 'Announcements', icon: Megaphone, permission: 'announcement.read' },
      { href: '/front-desk/reports', label: 'Reports', icon: BarChart3, permission: 'report.read' },
    ],
  },
];

export const STUDENT_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/student', label: 'Dashboard', icon: LayoutDashboard, exact: true }],
  },
  {
    label: 'My studies',
    items: [
      { href: '/student/courses', label: 'Courses', icon: BookOpen },
      { href: '/student/batches', label: 'Batches & timetable', icon: CalendarDays },
      { href: '/student/attendance', label: 'Attendance', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Fees',
    items: [
      { href: '/student/fees', label: 'Fee overview', icon: Wallet },
      { href: '/student/fees/ledger', label: 'Ledger', icon: FileText },
      { href: '/student/fees/receipts', label: 'Receipts', icon: Receipt },
    ],
  },
  {
    label: 'Records',
    items: [
      { href: '/student/certificates', label: 'Certificates', icon: FileBadge },
      { href: '/student/announcements', label: 'Announcements', icon: Megaphone },
      { href: '/student/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/student/profile', label: 'Profile', icon: Users },
      { href: '/student/settings', label: 'Account settings', icon: Settings },
    ],
  },
];

export function navFor(variant: 'admin' | 'front-desk' | 'student'): NavGroup[] {
  if (variant === 'admin') return ADMIN_NAV;
  if (variant === 'front-desk') return FRONT_DESK_NAV;
  return STUDENT_NAV;
}

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  FRONT_DESK: 'Front Desk Manager',
  STUDENT: 'Student',
};
