import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-border bg-card text-foreground hover:bg-card/80',
        success: 'border-transparent bg-accent text-accent-foreground hover:bg-accent/90',
        // Token-driven so the warning face follows the severity ramp in both themes.
        warning:
          'border-transparent bg-[hsl(var(--sev-medium))] text-[hsl(var(--sev-medium-fg))] hover:bg-[hsl(var(--sev-medium)/0.9)]',
        info: 'border-transparent bg-info text-info-foreground hover:bg-info/90',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };