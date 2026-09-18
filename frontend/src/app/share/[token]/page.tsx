import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, Clock, Ban, ArrowRight } from 'lucide-react';
import { severityTone, toneCallout, toneHue, toneInk, verdictTone } from '@/lib/tone';

export const metadata: Metadata = {
  title: 'Shared report',
  // Shared reports are private audit summaries: never indexed, never archived.
  robots: { index: false, follow: false },
};

interface PublicFinding {
  external_id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  confidence: number;
  file: string | null;
  line_start: number | null;
  evidence_kinds: string[];
  repair_attempted: boolean;
  repair_verified: boolean;
}

interface PublicReport {
  repository: { name: string; source_type: string; languages: string[] };
  scan: { status: string; configuration: string; finished_at: string | null };
  summary: {
    total_findings: number;
    by_severity: Record<string, number>;
    by_status: Record<string, number>;
    repairs_attempted: number;
    repairs_verified: number;
  };
  findings: PublicFinding[];
  share?: { view_count: number; expires_at: string | null };
}

/**
 * Severity and verdict faces for the shared report.
 *
 * Both read the shared tone layer, so a report sent to someone outside the
 * workspace uses exactly the colours the in-app surfaces use — a shared report
 * that disagreed with the app it came from would be worse than no report.
 */
function severityFace(severity: string | null | undefined): string {
  const tone = severityTone(severity);
  return `${toneCallout(tone)} ${toneInk(tone)}`;
}

function statusFace(status: string | null | undefined): string {
  const tone = verdictTone(status);
  return `${toneCallout(tone)} ${toneInk(tone)}`;
}

async function fetchReport(token: string): Promise<PublicReport | null> {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  try {
    const res = await fetch(`${base}/api/v1/public/reports/${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicReport;
  } catch {
    return null;
  }
}

export default async function SharedReportPage({
  params,
}: {
  params: { token: string };
}) {
  const report = await fetchReport(params.token);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
          </Link>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
            Sanitised summary — no source code included
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {!report ? (
          <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center">
            <Ban className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden />
            <h1 className="mt-4 font-display text-xl font-semibold">Report unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This share link is invalid, was revoked by its owner, or has expired.
              Ask the person who shared it for a fresh link.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Learn about RepoVeriX <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Audit report
                </p>
                <h1 className="type-page-title mt-1">
                  {report.repository.name}
                </h1>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="capitalize">{report.repository.source_type}</span>
                  {report.repository.languages.length > 0 && (
                    <span aria-hidden>·</span>
                  )}
                  <span>{report.repository.languages.join(' · ')}</span>
                  {report.scan.finished_at && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {new Date(report.scan.finished_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <Badge variant="outline" className="capitalize">
                {report.scan.configuration.replace('_', ' ')} scan
              </Badge>
            </div>

            {/* Summary tiles */}
            <div className="mt-8 grid gap-4 sm:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Findings</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">
                    {report.summary.total_findings}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Verified</p>
                  <p className={`mt-1 text-3xl font-bold tabular-nums ${toneHue('verified')}`}>
                    {report.summary.by_status.verified ?? 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Repairs attempted</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">
                    {report.summary.repairs_attempted}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Repairs verified</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-primary">
                    {report.summary.repairs_verified}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Findings (sanitised) */}
            <section className="mt-10">
              <h2 className="font-display text-xl font-semibold">Findings</h2>
              {report.findings.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  No findings were recorded for this scan.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {report.findings.map((f) => (
                    <li key={f.external_id}>
                      <Card>
                        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{f.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {f.category.replace('_', ' ')}
                              {f.file ? ` · ${f.file}` : ''}
                              {f.line_start ? ` :${f.line_start}` : ''}
                              {' · '}confidence {Math.round(f.confidence * 100)}%
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className={`capitalize ${severityFace(f.severity)}`}>
                              {f.severity}
                            </Badge>
                            <Badge variant="outline" className={`capitalize ${statusFace(f.status)}`}>
                              {f.status}
                            </Badge>
                            {f.repair_attempted && (
                              <Badge
                                variant="outline"
                                className={
                                  f.repair_verified ? `${toneCallout('verified')} ${toneInk('verified')}` : ''
                                }
                              >
                                {f.repair_verified ? 'fix verified' : 'fix attempted'}
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="mt-10 text-center text-xs text-muted-foreground">
              Generated by RepoVeriX — evidence-grounded repository auditing with verified
              automated repair.{' '}
              <Link href="/" className="font-medium text-primary hover:underline">
                Audit your own repositories
              </Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
