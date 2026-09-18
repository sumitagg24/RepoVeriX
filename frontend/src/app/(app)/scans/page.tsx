"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRepositories, useScans, useStartScan } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiErrorMessage, formatDate } from "@/lib/utils";

export default function ScansPage() {
  const repos = useRepositories();
  const [repoId, setRepoId] = useState("");
  const scans = useScans(repoId || undefined);
  const start = useStartScan();
  const [config, setConfig] = useState("repoverix");

  const repoName = useMemo(() => {
    const map = new Map((repos.data ?? []).map((r) => [r.id, r.name]));
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [repos.data]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Scans</h1>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-6">
          <label className="min-w-[220px] flex-1 text-[13px] font-semibold">
            Repository
            <Select className="mt-1.5" value={repoId} onChange={(e) => setRepoId(e.target.value)}>
              <option value="">All + pick for new scan</option>
              {(repos.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </label>
          <label className="text-[13px] font-semibold">
            Configuration
            <Select className="mt-1.5" value={config} onChange={(e) => setConfig(e.target.value)}>
              {["repoverix", "static_llm", "static_only", "llm_only"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </label>
          <Button
            disabled={!repoId || start.isPending}
            onClick={async () => {
              try {
                const s = await start.mutateAsync({ repository_id: repoId, configuration: config });
                toast.success("Scan started");
                window.location.href = `/scans/${s.id}`;
              } catch (e) {
                toast.error(apiErrorMessage(e, "Could not start scan"));
              }
            }}
          >
            {start.isPending ? "Starting…" : "Start scan"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        <CardContent className="space-y-2.5 p-6 pt-0">
          {scans.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {scans.data?.map((s) => (
            <Link key={s.id} href={`/scans/${s.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3 hover:border-primary/40">
              <StatusBadge value={s.status} />
              <span className="text-sm font-bold">{repoName(s.repository_id)}</span>
              <span className="font-mono text-xs text-muted-foreground">{s.configuration} · {formatDate(s.created_at)}</span>
            </Link>
          ))}
          {!scans.isLoading && !scans.data?.length && (
            <p className="text-sm text-muted-foreground">No scans yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
