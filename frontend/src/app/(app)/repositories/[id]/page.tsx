"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useRepository, useScans, useStartScan } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { apiErrorMessage, formatDate } from "@/lib/utils";
import type { ScanConfiguration } from "@/types/api";

const CONFIGS: ScanConfiguration[] = ["repoverix", "static_llm", "static_only", "llm_only"];

export default function RepositoryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const repo = useRepository(id);
  const scans = useScans(id);
  const start = useStartScan();
  const [config, setConfig] = useState<ScanConfiguration>("repoverix");

  return (
    <div className="space-y-6">
      <Link href="/repositories" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Repositories
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{repo.data?.name ?? "Repository"}</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {repo.data?.source_type} · {repo.data?.source_url ?? "zip"} · {repo.data && formatDate(repo.data.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={config} onChange={(e) => setConfig(e.target.value as ScanConfiguration)} aria-label="Scan configuration">
            {CONFIGS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Button
            disabled={start.isPending}
            onClick={async () => {
              try {
                const s = await start.mutateAsync({ repository_id: id, configuration: config });
                toast.success("Scan started");
                window.location.href = `/scans/${s.id}`;
              } catch (e) {
                toast.error(apiErrorMessage(e, "Could not start scan"));
              }
            }}
          >
            {start.isPending ? "Starting…" : "Start scan"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Scans</CardTitle></CardHeader>
        <CardContent className="space-y-2.5 p-6 pt-0">
          {scans.data?.map((s) => (
            <Link
              key={s.id}
              href={`/scans/${s.id}`}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3 hover:border-primary/40"
            >
              <StatusBadge value={s.status} />
              <span className="font-mono text-xs text-muted-foreground">{s.configuration}</span>
              <span className="ml-auto flex items-center gap-2 text-sm font-semibold">
                {formatDate(s.created_at)} <ArrowUpRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
          {!scans.isLoading && !scans.data?.length && (
            <p className="text-sm text-muted-foreground">No scans yet — start one above.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
