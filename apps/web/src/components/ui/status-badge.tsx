import { Badge, type BadgeProps } from './badge';
import { labelize } from '@/lib/format';

const VARIANTS: Record<string, BadgeProps['variant']> = {
  ACTIVE: 'success',
  PRESENT: 'success',
  PAID: 'success',
  ISSUED: 'success',
  PUBLISHED: 'success',
  COMPLETED: 'info',
  FINALIZED: 'info',
  POSTED: 'info',
  PASS: 'success',
  OPEN: 'warning',
  LATE: 'warning',
  PARTIALLY_PAID: 'warning',
  PARTIALLY_REVERSED: 'warning',
  PENDING: 'warning',
  PLANNED: 'neutral',
  SCHEDULED: 'neutral',
  DRAFT: 'neutral',
  INVITED: 'info',
  SUSPENDED: 'danger',
  DISABLED: 'danger',
  WITHDRAWN: 'neutral',
  ARCHIVED: 'neutral',
  INACTIVE: 'neutral',
  CANCELLED: 'danger',
  ABSENT: 'danger',
  FAIL: 'danger',
  REVOKED: 'danger',
  VOID: 'neutral',
  REVERSED: 'danger',
  EXCUSED: 'info',
  GRADUATED: 'info',
  CLOSED: 'neutral',
};

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return <Badge variant="neutral">—</Badge>;
  return (
    <Badge variant={VARIANTS[status] ?? 'neutral'} className={className}>
      {labelize(status)}
    </Badge>
  );
}
