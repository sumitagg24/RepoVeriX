"use client";

import Link from "next/link";
import { useState } from "react";
import { useFindings } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { SeverityBadge, StatusBadge } from "@/components/ui/badge";

export default function FindingsPage() {
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const q = useFindings({
    ...(severity ? { severity } : {}),
    ...(status ? { status } : {}),
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Findings</h1>
      <Card>
        <CardContent className="flex flex-wrap gap-3 p-5">
          <label className="text-[13px] font-semibold">
            Severity
            <Select className="mt-1.5 w-44" value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="">All</option>
              {["critical", "high", "medium", "low", "info"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </label>
          <label className="text-[13px] font-semibold">
            Status
            <Select className="mt-1.5 w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {["verified", "probable", "rejected"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{q.data?.length ?? 0} results</CardTitle></CardHeader>
        <CardContent className="space-y-2.5 p-6 pt-0">
          {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {q.data?.map((f) => (
            <Link key={f.id} href={`/findings/${f.id}`} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 hover:border-primary/40">
              <SeverityBadge value={f.severity} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{f.title}</span>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">
                  {f.category} · {f.file_path}{f.line_start ? `:${f.line_start}` : ""}
                </span>
              </span>
              <StatusBadge value={f.status} />
            </Link>
          ))}
          {!q.isLoading && !q.data?.length && (
            <p className="text-sm text-muted-foreground">No findings match these filters.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
