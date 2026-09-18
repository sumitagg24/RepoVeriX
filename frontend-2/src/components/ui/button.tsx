'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Actions.
 *
 * `primary` is neutral ink chrome rather than the accent, so a page full of
 * severity colour never fights a blue button. The accent variant exists for the
 * one place a page genuinely needs to point at the product colour.
 *
 * Every variant is checked for label contrast: chrome pairs #f7f9fa on #12181d
 * (15.9:1), accent pairs #ffffff on #2f5bd0 (5.9:1), danger pairs #ffffff on
 * #b3342c (6.1:1). Ghost and link carry the page text colour.
 */
const button = cva(
  [
    'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap',
    'font-medium tracking-[-0.005em] transition-[background-color,border-color,color,transform]',
    'duration-150 ease-out-quint active:translate-y-px',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-chrome text-chrome-label hover:bg-chrome-hover',
        accent: 'bg-accent text-on-accent hover:bg-accent-strong',
        secondary:
          'border border-hairline bg-card text-ink hover:border-hairline-strong hover:bg-card-hover',
        subtle: 'bg-surface text-ink hover:bg-surface-strong',
        ghost: 'text-body hover:bg-surface hover:text-ink',
        danger: 'bg-critical text-white hover:bg-critical/90',
        link: 'p-0 text-accent underline-offset-4 hover:underline active:translate-y-0',
      },
      size: {
        sm: 'h-8 rounded-md px-3 text-[13px]',
        md: 'h-9 rounded-md px-3.5 text-sm',
        lg: 'h-11 rounded-md px-5 text-[15px]',
        icon: 'size-9 rounded-md',
        'icon-sm': 'size-7 rounded-sm',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  /** Render the styling on a child element (a Link, usually). */
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, loading = false, children, disabled, ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      ref={ref}
      className={cn(button({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </Component>
  );
});

/** Icon-only control: always give it a label, and pair it with a Tooltip. */
export const IconButton = React.forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(
  function IconButton({ label, children, className, ...props }, ref) {
    return (
      <Button ref={ref} size="icon" variant="ghost" aria-label={label} className={className} {...props}>
        {children}
      </Button>
    );
  },
);

export { button as buttonStyles };
