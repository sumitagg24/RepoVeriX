"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/services/api";
import type { PatchRead } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default function PatchPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const q = useQuery({
    queryKey: ["patch", id],
    queryFn: async () => (await api.get<PatchRead>(`/patches/${id}`)).data,
  });
  const p = q.data;

  return (
    <div className="space-y-6">
      <Link
        href={p ? `/findings/${p.finding_id}` : "/findings"}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to finding
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Patch <span className="font-mono text-xl text-muted-foreground">{id.slice(0, 8)}…</span>
        </h1>
        {p && <StatusBadge value={p.status} />}
      </div>
      {p && (
        <p className="font-mono text-xs text-muted-foreground">
          {p.generated_by} · {formatDate(p.created_at)}
        </p>
      )}
      {p?.explanation && (
        <Card>
          <CardContent className="p-5 text-[15px] leading-relaxed">{p.explanation}</CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Unified diff</CardTitle></CardHeader>
        <CardContent className="p-6 pt-0">
          <pre className="overflow-x-auto rounded-2xl bg-black p-5 font-mono text-[12px] leading-relaxed text-white/85">
            {p?.diff ?? (q.isLoading ? "Loading…" : "No diff available.")}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
