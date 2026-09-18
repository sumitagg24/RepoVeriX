"use client";

import Link from "next/link";
import { ArrowLeft, Ban, Download } from "lucide-react";
import { useCancelScan, useFindings, useScan } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeverityBadge, StatusBadge } from "@/components/ui/badge";
import { toast } from "sonner";
import { API_BASE } from "@/lib/site";
import { getToken } from "@/services/api";
import { apiErrorMessage, formatDate } from "@/lib/utils";

export default function ScanDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const scan = useScan(id, true);
  const findings = useFindings({ scan_id: id });
  const cancel = useCancelScan();

  const running =
    scan.data?.status === "pending" || scan.data?.status === "running";

  return (
    <div className="space-y-6">
      <Link href="/scans" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Scans
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display flex flex-wrap items-center gap-3 text-3xl font-extrabold tracking-tight">
            Scan <span className="font-mono text-xl text-muted-foreground">{id.slice(0, 8)}…</span>
            {scan.data && <StatusBadge value={scan.data.status} />}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {scan.data?.configuration} · started {formatDate(scan.data?.started_at ?? scan.data?.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          {running && (
            <Button
              variant="outline"
              disabled={cancel.isPending}
              onClick={async () => {
                try {
                  await cancel.mutateAsync(id);
                  toast.success("Cancel requested");
                } catch (e) {
                  toast.error(apiErrorMessage(e, "Cancel failed"));
                }
              }}
            >
              <Ban className="h-4 w-4" /> Cancel
            </Button>
          )}
          <Button
            variant="ink"
            onClick={async () => {
              const token = getToken();
              const res = await fetch(`${API_BASE}/scans/${id}/report?format=markdown`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              if (!res.ok) {
                // 402 = Pro-gated report, 404/409 = not ready — surface the
                // backend's own message instead of guessing.
                const data = await res.json().catch(() => null);
                const msg =
                  typeof data?.detail === "string" && data.detail
                    ? data.detail
                    : "Report not ready yet";
                toast.error(msg);
                return;
              }
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `repoverix-scan-${id.slice(0, 8)}.md`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4" /> Report
          </Button>
        </div>
      </div>

      {scan.data?.error && (
        <Card className="border-red-200 bg-red-50/70 p-5 text-sm font-medium text-red-700">
          {scan.data.error}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader><CardTitle>Findings ({findings.data?.length ?? 0})</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 p-6 pt-0">
            {findings.data?.map((f) => (
              <Link key={f.id} href={`/findings/${f.id}`} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 hover:border-primary/40">
                <SeverityBadge value={f.severity} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{f.title}</span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">{f.file_path}</span>
                </span>
                <StatusBadge value={f.status} />
              </Link>
            ))}
            {!findings.isLoading && !findings.data?.length && (
              <p className="text-sm text-muted-foreground">
                {running ? "Scan still running — findings stream in live." : "No findings. Clean — or nothing reachable."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pipeline stages</CardTitle></CardHeader>
          <CardContent className="space-y-2 p-6 pt-0">
            {(scan.data?.analysis_runs ?? []).map((r) => (
              <div key={r.id} className="flex items-center gap-2.5 rounded-xl bg-secondary/70 px-3.5 py-2.5">
                <StatusBadge value={r.status} />
                <span className="font-mono text-xs">{r.stage}{r.tool_name ? ` · ${r.tool_name}` : ""}</span>
              </div>
            ))}
            {!scan.data?.analysis_runs?.length && (
              <p className="text-sm text-muted-foreground">Stages appear here as the orchestrator runs.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
