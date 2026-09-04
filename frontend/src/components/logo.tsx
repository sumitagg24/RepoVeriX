import { cn } from '@/lib/utils';

/**
 * RepoVeriX brand mark — a point-top hexagonal "verified seal" cut with an X,
 * the brand's single source of truth for the logo glyph. Rendered with
 * `currentColor` so every context (sidebar tile, nav, auth screens, footer)
 * shares identical geometry and inherits the local theme color.
 *
 * viewBox is 24×24 and geometry is stroke-based so it stays crisp from 16px
 * (favicon) to 96px (marketing) without needing alternate assets.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      focusable="false"
    >
      {/* Hexagonal seal */}
      <path
        d="M12 1.7 17.1 3.05 22.3 12 17.1 20.95 6.9 20.95 1.7 12 6.9 3.05 Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* The X — RepoVeriX monogram */}
      <path
        d="M7.05 7.05 L16.95 16.95"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M16.95 7.05 L7.05 16.95"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Full brand lockup: mark + the Fraunces wordmark with the X accented in the
 * primary color. This is the only way the brand name should be rendered —
 * mark and wordmark travel together so the identity stays uniform.
 */
export function Logo({
  className,
  markClassName,
  withTagline = false,
}: {
  className?: string;
  markClassName?: string;
  withTagline?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
        <LogoMark className="h-[19px] w-[19px]" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-[17px] font-semibold tracking-tight">
          RepoVeri
          <span className="text-primary">X</span>
        </span>
        {withTagline && (
          <span className="block text-[11px] text-muted-foreground">audit · repair · verify</span>
        )}
      </span>
    </span>
  );
}

/** Just the glyph for tiny placements (footer etc.). */
export function LogoGlyph({ className }: { className?: string }) {
  return <LogoMark className={className} />;
}
