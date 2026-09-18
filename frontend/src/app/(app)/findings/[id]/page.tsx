"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  FlaskConical,
  GitBranch,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  useFinding,
  useGenerateFix,
  usePatchVerifications,
  useVerification,
  useVerifyPatch,
} from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeverityBadge, StatusBadge } from "@/components/ui/badge";
import { apiErrorMessage, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function FindingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const detail = useFinding(id);
  const genFix = useGenerateFix();
  const verify = useVerifyPatch();
  const [activePatch, setActivePatch] = useState<string | null>(null);
  const verifs = usePatchVerifications(activePatch ?? undefined);
  const [activeRun, setActiveRun] = useState<string | null>(null);
  const run = useVerification(activeRun ?? undefined, true);

  const f = detail.data;
  const patches = f?.patches ?? [];
  const evidence = [...(f?.evidence ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );

  return (
    <div className="space-y-6">
      <Link href="/findings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Findings
      </Link>

      {detail.isLoading && <p className="text-sm text-muted-foreground">Loading finding…</p>}
      {detail.isError && (
        <Card className="p-5 text-sm text-red-600">Couldn’t load this finding.</Card>
      )}

      {f && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge value={f.severity} />
                <StatusBadge value={f.status} />
                <span className="font-mono text-xs text-muted-foreground">
                  conf {f.confidence.toFixed(2)} · {f.category} · {f.source}
                </span>
              </div>
              <h1 className="font-display mt-3 text-3xl font-extrabold tracking-tight">{f.title}</h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {f.file_path}
                {f.line_start ? `:${f.line_start}${f.line_end ? `–${f.line_end}` : ""}` : ""}
                {f.function_name ? ` · ${f.function_name}()` : ""} · {formatDate(f.created_at)}
              </p>
            </div>
            <Button
              disabled={genFix.isPending}
              onClick={async () => {
                try {
                  const p = await genFix.mutateAsync(f.id);
                  setActivePatch(p.id);
                  toast.success("Candidate patch generated");
                } catch (e) {
                  toast.error(apiErrorMessage(e, "No repair applies here"));
                }
              }}
            >
              <GitBranch className="h-4 w-4" />
              {genFix.isPending ? "Generating…" : "Generate fix"}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>What & why</CardTitle></CardHeader>
                <CardContent className="space-y-3 p-6 pt-0 text-[15px] leading-relaxed">
                  <p>{f.description}</p>
                  {f.impact && (
                    <p className="rounded-xl bg-red-500/[0.07] px-4 py-3 text-sm">
                      <strong>Impact — </strong>{f.impact}
                    </p>
                  )}
                  {f.recommendation && (
                    <p className="rounded-xl bg-emerald-500/[0.08] px-4 py-3 text-sm">
                      <strong>Recommendation — </strong>{f.recommendation}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Evidence chain ({evidence.length})</CardTitle></CardHeader>
                <CardContent className="p-6 pt-0">
                  {evidence.length === 0 && (
                    <p className="text-sm text-muted-foreground">No evidence attached.</p>
                  )}
                  <ol className="relative space-y-0">
                    {evidence.map((e, i) => (
                      <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                        {i < evidence.length - 1 && (
                          <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-border" />
                        )}
                        <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black font-mono text-[11px] font-bold text-white dark:bg-white dark:text-black">
                          {e.order_index}
                        </span>
                        <div className="min-w-0 flex-1 rounded-xl border border-border bg-muted/40 px-4 py-3">
                          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-primary">{e.kind}</p>
                          <p className="mt-1 text-sm font-medium">{e.description}</p>
                          {(e.file_path || e.snippet) && (
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                              {e.file_path}
                              {e.line_start ? `:${e.line_start}${e.line_end ? `–${e.line_end}` : ""}` : ""}
                            </p>
                          )}
                          {e.snippet && (
                            <pre className="mt-2 overflow-x-auto rounded-lg bg-black p-3 font-mono text-[11px] leading-relaxed text-white/85">
                              {e.snippet.slice(0, 1200)}
                            </pre>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="bg-black text-white">
                <CardHeader><CardTitle className="!text-white">Patches ({patches.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2.5 p-6 pt-0">
                  {patches.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActivePatch(p.id);
                        setActiveRun(null);
                      }}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                        activePatch === p.id
                          ? "border-primary bg-primary/15"
                          : "border-white/10 bg-white/[0.04] hover:border-white/25",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-white/60">{p.generated_by}</span>
                        <StatusBadge value={p.status} />
                      </span>
                      <span className="mt-1 block truncate text-sm font-bold">{p.explanation ?? "Candidate patch"}</span>
                    </button>
                  ))}
                  {!patches.length && (
                    <p className="text-sm text-white/60">No patches yet — generate one above.</p>
                  )}
                </CardContent>
              </Card>

              {activePatch && (
                <PatchPanel
                  patchId={activePatch}
                  verifs={verifs.data ?? []}
                  onVerify={async () => {
                    try {
                      const r = await verify.mutateAsync(activePatch);
                      setActiveRun(r.id);
                      toast.success("Verification started in sandbox");
                    } catch (e) {
                      toast.error(apiErrorMessage(e, "Verification failed to start"));
                    }
                  }}
                  verifying={verify.isPending}
                  onSelectRun={setActiveRun}
                  activeRun={activeRun}
                />
              )}

              {activeRun && run.data && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-primary" /> Sandbox verdict
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 p-6 pt-0 text-sm">
                    <StatusBadge value={run.data.status} />
                    <dl className="grid grid-cols-2 gap-2 pt-2 font-mono text-[11px] text-muted-foreground">
                      <span>patch {run.data.patch_applied ? "applied ✓" : "not applied ✗"}</span>
                      <span>deps {run.data.deps_installed ? "installed ✓" : "skipped"}</span>
                      <span>tests {run.data.tests_passed == null ? "—" : run.data.tests_passed ? "passed ✓" : "failed ✗"}</span>
                      <span>static {run.data.static_passed == null ? "—" : run.data.static_passed ? "passed ✓" : "failed ✗"}</span>
                    </dl>
                    {(run.data.test_results ?? []).length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {(run.data.test_results ?? []).slice(0, 8).map((t) => (
                          <p key={t.id} className="flex items-center gap-2 font-mono text-[11px]">
                            <ShieldCheck className={cn("h-3.5 w-3.5", t.outcome === "passed" ? "text-emerald-500" : "text-red-500")} />
                            {t.test_name} · {t.outcome}
                          </p>
                        ))}
                      </div>
                    )}
                    {run.data.logs && (
                      <pre className="max-h-56 overflow-auto rounded-xl bg-black p-3 font-mono text-[11px] text-white/80">
                        {run.data.logs.slice(0, 4000)}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PatchPanel({
  patchId,
  verifs,
  onVerify,
  verifying,
  onSelectRun,
  activeRun,
}: {
  patchId: string;
  verifs: { id: string; status: string; created_at: string }[];
  onVerify: () => void;
  verifying: boolean;
  onSelectRun: (id: string) => void;
  activeRun: string | null;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>Verify in sandbox</CardTitle></CardHeader>
      <CardContent className="space-y-3 p-6 pt-0">
        <Button className="w-full" disabled={verifying} onClick={onVerify}>
          <FlaskConical className="h-4 w-4" /> {verifying ? "Starting…" : "Run Docker verification"}
        </Button>
        {verifs.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelectRun(v.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left hover:border-primary/40",
              activeRun === v.id ? "border-primary" : "border-border",
            )}
          >
            <StatusBadge value={v.status} />
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">
              {formatDate(v.created_at)}
            </span>
          </button>
        ))}
        {!verifs.length && (
          <p className="text-[13px] text-muted-foreground">
            Applies the diff to a disposable copy, runs your tests + static checks, re-analyses the sink.
          </p>
        )}
        <Link href={`/patches/${patchId}`} className="block text-center text-[13px] font-bold text-primary hover:underline">
          Open full diff view
        </Link>
      </CardContent>
    </Card>
  );
}
