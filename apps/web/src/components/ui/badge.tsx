import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary-soft text-accent-foreground',
        neutral: 'border-transparent bg-muted text-muted-foreground',
        success: 'border-transparent bg-[hsl(152_45%_93%)] text-[hsl(152_65%_24%)]',
        warning: 'border-transparent bg-[hsl(38_95%_94%)] text-[hsl(30_85%_30%)]',
        danger: 'border-transparent bg-[hsl(0_85%_96%)] text-[hsl(0_70%_38%)]',
        info: 'border-transparent bg-[hsl(214_90%_95%)] text-[hsl(218_70%_36%)]',
        outline: 'border-border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
