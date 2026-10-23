import * as React from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/60 px-6 py-14 text-center', className)}>
      <span className="mb-3 rounded-full bg-muted p-3 text-muted-foreground">
        {icon ?? <Inbox className="h-6 w-6" />}
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-12 text-center">
      <span className="mb-3 rounded-full bg-destructive/10 p-3 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      {message ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
