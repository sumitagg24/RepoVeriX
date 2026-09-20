import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * Brand mark.
 *
 * A single geometric glyph: a proof box with a check that breaks its frame. It
 * is deliberately simple so it reads at 20px and can be recoloured by one token.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-5 shrink-0', className)}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 12.4l2.6 2.6L16.4 9.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({
  href = '/',
  className,
  showMark = true,
  label = 'RepoVeriX home',
}: {
  href?: string;
  className?: string;
  showMark?: boolean;
  label?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        // py-0.5 keeps the brand link at the 24px minimum target size.
        'inline-flex items-center gap-2 rounded-sm py-0.5 text-ink transition-opacity hover:opacity-80',
        className,
      )}
    >
      {showMark ? <LogoMark className="text-accent" /> : null}
      <span className="text-[15px] font-semibold tracking-[-0.02em]">RepoVeriX</span>
    </Link>
  );
}
