import * as React from 'react';
import { Card } from './card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

const TONE_STYLES: Record<NonNullable<MetricCardProps['tone']>, string> = {
  default: 'bg-primary-soft text-accent-foreground',
  success: 'bg-[hsl(152_45%_93%)] text-[hsl(152_65%_24%)]',
  warning: 'bg-[hsl(38_95%_94%)] text-[hsl(30_85%_30%)]',
  danger: 'bg-[hsl(0_85%_96%)] text-[hsl(0_70%_38%)]',
};

export function MetricCard({ label, value, hint, icon, tone = 'default', className }: MetricCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-semibold tracking-tight">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {icon ? <span className={cn('rounded-lg p-2.5', TONE_STYLES[tone])}>{icon}</span> : null}
      </div>
    </Card>
  );
}
