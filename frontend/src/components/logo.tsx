import { cn } from '@/lib/utils';

/*
 * RepoVeriX brand mark — the "VeriX tick".
 *
 * One concept: an X that resolves into a verification tick. The long
 * down-stroke and the top-left crossing read as the RepoVeriX X; the
 * bottom-left arm is lifted and folded back into a check, so the glyph reads
 * "X → ✓": find the problem, then certify it's fixed — audit · repair ·
 * verify.
 *
 * The mark is deliberately transparent — no seal, no tile, no backdrop. It
 * floats on whatever surface it sits on. Contrast is guaranteed by the
 * gradient's *range*, not by a container: every stop stays in a calibrated
 * mid-tone band (rust L≈0.13 → amber L≈0.26). That band clears ~3:1 on
 * ivory *and* near-black, so no part of the stroke ever washes out in
 * either theme. Measured, not eyeballed. Every colour is a fixed literal —
 * no currentColor, no theme variables, no transparency blends.
 */

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} focusable="false">
      <defs>
        <linearGradient
          id="rvx-grad"
          x1="4"
          y1="20"
          x2="20"
          y2="4"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#a84926" />
          <stop offset="50%" stopColor="#c26731" />
          <stop offset="100%" stopColor="#ca7b2c" />
        </linearGradient>
      </defs>

      {/* The X's long down-stroke (top-left → bottom-right). */}
      <path
        d="M6.6 6.6 L17.4 17.4"
        stroke="url(#rvx-grad)"
        strokeWidth="3.6"
        strokeLinecap="round"
        fill="none"
      />

      {/* The arm that crosses it and folds back into a check. */}
      <path
        d="M17.4 6.6 L9.3 14.7 L14.7 14.7 L14.7 10.3"
        stroke="url(#rvx-grad)"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * Full brand lockup: mark + the wordmark with the X accented in the primary
 * color. This is the only way the brand name should be rendered — mark and
 * wordmark travel together so the identity stays uniform.
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
      <LogoMark className={cn('h-7 w-7 shrink-0', markClassName)} />
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
