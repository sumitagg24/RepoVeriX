"use client";

import Link from "next/link";
import {
  ArrowRight,
  FileSearch,
  FolderGit2,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { useDashboard, useFindings } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const dash = useDashboard();
  const recent = useFindings({});

  const summary = dash.data;
  const sev = summary?.findings.by_severity ?? {};
  const total = summary?.findings.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Security overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Evidence-grounded posture across every connected repository.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/repositories">Connect repo</Link>
          </Button>
          <Button asChild>
            <Link href="/scans">New scan <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>

      {dash.isError && (
        <Card className="border-red-200 bg-red-50/60 p-5 text-sm font-medium text-red-700">
          Couldn’t load the dashboard. Is the backend running at{" "}
          <code>NEXT_PUBLIC_API_URL</code>?
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: FolderGit2, label: "Repositories", value: summary?.total_repositories ?? "—" },
          { icon: ScanSearch, label: "Scans", value: summary?.total_scans ?? "—" },
          { icon: FileSearch, label: "Findings", value: total },
          { icon: ShieldCheck, label: "Critical + High", value: (Number(sev.critical ?? 0) + Number(sev.high ?? 0)) || "0" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-4 p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-white dark:bg-white dark:text-black">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-3xl font-extrabold tabular-nums">{String(s.value)}</p>
                  <p className="text-[13px] font-semibold text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Latest findings</CardTitle>
            <Link href="/findings" className="text-[13px] font-bold text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recent.isLoading && (
              <p className="px-6 pb-6 text-sm text-muted-foreground">Loading…</p>
            )}
            {recent.data?.slice(0, 7).map((f) => (
              <Link
                key={f.id}
                href={`/findings/${f.id}`}
                className="flex items-center gap-3 border-t border-border px-6 py-3.5 transition-colors first:border-t-0 hover:bg-secondary/60"
              >
                <SeverityBadge value={f.severity} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{f.title}</span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {f.file_path} · {formatDate(f.created_at)}
                  </span>
                </span>
                <StatusBadge value={f.status} />
              </Link>
            ))}
            {!recent.isLoading && !recent.data?.length && (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                No findings yet — connect a repo and run your first scan.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-black text-white">
          <CardHeader>
            <CardTitle className="!text-white">How trust works here</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-white/70">
            <p><strong className="text-white">1. Evidence required.</strong> No chain, no finding.</p>
            <p><strong className="text-white">2. Patches are candidates.</strong> Templates first, LLM second.</p>
            <p><strong className="text-white">3. Docker decides.</strong> Tests + re-analysis = VERIFIED REPAIR.</p>
            <Button className="mt-2 w-full" asChild>
              <Link href="/repositories">Audit your first repo</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
