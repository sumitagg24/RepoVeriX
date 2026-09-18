import * as React from 'react';
import { BadgeCheck, FileCode2, ScanSearch, ShieldCheck } from 'lucide-react';

import { Badge, SeverityBadge, VerdictBadge } from '@/components/ui/badge';
import { SeverityTally } from '@/components/findings/finding-table';
import { CodeExcerpt } from '@/components/ui/code';
import { SAMPLE_FINDINGS } from '@/lib/samples';

/**
 * The workspace, shown as it actually renders.
 *
 * This is not a mock screenshot drawn from coloured rectangles: it is the real
 * primitives (severity badges, verdict badges, the findings tally, the code
 * excerpt) composed inside a framed window, with the shell's own dark theme
 * applied by wrapping it in `.dark`. The sidebar carries the real navigation
 * labels, so the picture of the product cannot drift from the product.
 *
 * All rows are sample records, and the caption says so.
 */
const NAV = [
  { label: 'Overview', icon: ShieldCheck },
  { label: 'Repositories', icon: FileCode2 },
  { label: 'Scans', icon: ScanSearch },
  { label: 'Findings', icon: ShieldCheck, active: true },
  { label: 'Rules', icon: FileCode2 },
];

export function WorkspaceScreenshot({ className }: { className?: string }) {
  return (
    <figure className={className}>
      <div className="app-frame dark overflow-hidden">
        <div className="app-frame-chrome flex items-center gap-3 px-4 py-2.5">
          <span className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-[#f0605c]" />
            <span className="size-2.5 rounded-full bg-[#f0bd4f]" />
            <span className="size-2.5 rounded-full bg-[#61c454]" />
          </span>
          <span className="truncate font-mono text-[11.5px] opacity-70">
            repoverix · findings · payments-api
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[11rem_minmax(0,1fr)]">
          <nav
            aria-hidden="true"
            className="hidden border-r border-[var(--frame-hairline)] px-2.5 py-3.5 md:block"
          >
            <ul className="space-y-1">
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.label}>
                    <span
                      className={
                        item.active
                          ? 'flex items-center gap-2.5 rounded-md bg-white/10 px-2.5 py-2 text-[12.5px] font-medium'
                          : 'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] opacity-65'
                      }
                    >
                      <Icon className="size-3.5" />
                      {item.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="min-w-0 space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[13.5px] font-semibold">Findings</p>
                <p className="mt-0.5 text-[11.5px] opacity-60">
                  Every claim, with the verdict validation recorded.
                </p>
              </div>
              <Badge tone="verified">
                <BadgeCheck className="size-3" aria-hidden="true" />
                3 verified
              </Badge>
            </div>

            <SeverityTally bySeverity={{ critical: 1, high: 2, medium: 1, low: 1, info: 0 }} />

            <div className="overflow-hidden rounded-md border border-[var(--frame-hairline)]">
              <table className="w-full">
                <caption className="sr-only">Sample findings from a scan</caption>
                <thead>
                  <tr className="border-b border-[var(--frame-hairline)]">
                    <th scope="col" className="px-3 py-2 text-left text-[11.5px] font-medium opacity-60">
                      Severity
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-[11.5px] font-medium opacity-60">
                      Finding
                    </th>
                    <th scope="col" className="hidden px-3 py-2 text-left text-[11.5px] font-medium opacity-60 sm:table-cell">
                      Location
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-[11.5px] font-medium opacity-60">
                      Verdict
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_FINDINGS.map((finding, index) => (
                    <tr
                      key={finding.title}
                      className={index === 0 ? 'bg-white/[0.06]' : undefined}
                    >
                      <td className="px-3 py-2.5 align-top">
                        <SeverityBadge severity={finding.severity} compact />
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <span className="text-[12.5px] font-medium leading-snug">{finding.title}</span>
                        <span className="mt-0.5 block font-mono text-[11px] opacity-55">
                          {finding.rule}
                        </span>
                      </td>
                      <td className="hidden px-3 py-2.5 align-top sm:table-cell">
                        <span className="font-mono text-[11.5px] opacity-75">{finding.path}</span>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <VerdictBadge status={finding.verdict} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <CodeExcerpt
                code={`41  def search_users(request):
42      term = request.args.get("q")
43      query = f"SELECT * FROM users WHERE name = '{term}'"
44      cursor.execute(query)`}
                startLine={41}
                highlight={{ start: 43, end: 44 }}
                tone="critical"
                label="app/search.py"
                maxHeight="max-h-40"
              />
              <div className="space-y-2.5">
                {VERIFICATION_ROWS.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3 rounded-md border border-[var(--frame-hairline)] px-3 py-2.5"
                  >
                    <span className="text-[12.5px] opacity-80">{row.label}</span>
                    <span
                      className={
                        row.passed ? 'text-[12px] font-medium text-verified' : 'text-[12px] opacity-60'
                      }
                    >
                      {row.passed ? 'passed' : 'not run'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <figcaption className="mt-3 text-[12.5px] text-muted">
        The findings workspace with sample records. The layout, badges and code view are the ones the
        product renders.
      </figcaption>
    </figure>
  );
}

const VERIFICATION_ROWS = [
  { label: 'Patch applied to a copy', passed: true },
  { label: 'Dependencies resolved', passed: true },
  { label: 'Generated test reproduces the issue', passed: true },
  { label: 'Static re-analysis clean', passed: true },
];
