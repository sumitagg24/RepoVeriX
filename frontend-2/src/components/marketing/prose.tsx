import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Documentation prose.
 *
 * Element styles are declared once, with child selectors, instead of a typography
 * plugin: headings, paragraphs, lists, tables and inline code get one treatment
 * across every docs page, and the class list stays visible in the markup.
 */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'max-w-[72ch] text-[15px] leading-[1.7] text-body',
        '[&_h2]:mt-12 [&_h2]:text-[22px] [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:tracking-tight [&_h2]:text-ink',
        '[&_h2:first-child]:mt-0',
        '[&_h3]:mt-8 [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-ink',
        '[&_p]:mt-4',
        '[&_ul]:mt-4 [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:list-disc [&_li]:marker:text-faint',
        '[&_ol]:mt-4 [&_ol]:space-y-2 [&_ol]:pl-5 [&_ol>li]:list-decimal [&_ol>li]:marker:text-faint',
        '[&_a]:text-accent [&_a]:underline-offset-4 hover:[&_a]:underline',
        '[&_strong]:font-medium [&_strong]:text-ink',
        '[&_code]:rounded-xs [&_code]:border [&_code]:border-hairline [&_code]:bg-surface [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[12.5px] [&_code]:text-ink',
        '[&_table]:mt-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-[13.5px]',
        '[&_th]:border-b [&_th]:border-hairline [&_th]:py-2.5 [&_th]:pr-4 [&_th]:text-[12px] [&_th]:font-medium [&_th]:text-muted',
        '[&_td]:border-b [&_td]:border-hairline [&_td]:py-3 [&_td]:pr-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Terminal-style block for curl examples and API payloads. */
export function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <figure className="code-surface mt-5 min-w-0 overflow-hidden">
      {label ? (
        <figcaption className="border-b border-hairline bg-surface px-3 py-1.5 font-mono text-[11.5px] text-muted">
          {label}
        </figcaption>
      ) : null}
      <pre className="overflow-x-auto px-3.5 py-3 text-[12.5px] leading-[1.7] text-ink">{children}</pre>
    </figure>
  );
}

export function CalloutNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-md border border-accent-line bg-accent-soft px-4 py-3.5">
      <p className="text-[13.5px] font-medium text-accent">{title}</p>
      <div className="mt-1.5 text-[13.5px] leading-relaxed text-body [&_a]:text-accent [&_a]:underline-offset-4 hover:[&_a]:underline">
        {children}
      </div>
    </div>
  );
}
