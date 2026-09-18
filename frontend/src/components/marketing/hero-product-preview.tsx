'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Play,
  ShieldCheck,
  Terminal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Tab = 'vuln' | 'path' | 'patch' | 'verify';

export function HeroProductPreview() {
  const [activeTab, setActiveTab] = useState<Tab>('patch');

  return (
    <div className="relative mx-auto w-full max-w-5xl rounded-2xl border border-border/80 bg-card p-1.5 shadow-2xl ring-1 ring-border/50 lg:rounded-3xl lg:p-2.5">
      {/* Background ambient glow */}
      <div className="absolute -inset-1 -z-10 rounded-3xl bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent blur-2xl opacity-60 dark:opacity-30" />

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card/95 backdrop-blur-md">
        {/* App Frame Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-500/80" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="mx-2 h-4 w-px bg-border/80" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-foreground">vulnerable_app</span>
              <span>/</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-foreground/80">main</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Continuous Analysis Active
            </span>
          </div>
        </div>

        {/* Workspace Toolbar / Findings Strip */}
        <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
          {/* Left: Finding Selector */}
          <div className="border-b border-border/60 p-4 lg:border-b-0 lg:border-r bg-muted/10">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Detected Risks
              </span>
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                1 Critical
              </Badge>
            </div>

            <div className="mt-3 space-y-2">
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-left transition-all shadow-sm">
                <div className="flex items-center justify-between gap-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    Critical Risk
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    RVX-SQLI-001
                  </span>
                </div>
                <h4 className="mt-1 text-xs font-semibold text-foreground leading-snug">
                  SQL Injection in /search route
                </h4>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground truncate">
                  app/routes/search.py:42
                </p>
                <div className="mt-2.5 flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Automated fix verified
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-background/50 p-2.5 text-left opacity-70 hover:opacity-100 transition-opacity">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    Medium Risk
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">RVX-CORS-004</span>
                </div>
                <h5 className="mt-1 text-xs font-medium text-foreground/90 truncate">
                  Permissive CORS wildcard origin
                </h5>
                <p className="font-mono text-[10px] text-muted-foreground truncate">app/middleware.py:18</p>
              </div>
            </div>
          </div>

          {/* Right: Master Inspector Surface */}
          <div className="p-4 sm:p-6 flex flex-col justify-between min-h-[360px]">
            <div>
              {/* Finding Title Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground sm:text-lg">
                      SQL Injection via Request Parameter
                    </h3>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                      Remediated &amp; Verified
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Untrusted query parameter <code className="font-mono text-foreground font-semibold">name</code> flows directly into raw SQL execution without parameterization.
                  </p>
                </div>

                {/* Inspector View Navigation */}
                <div className="flex items-center rounded-lg border border-border/80 bg-muted/60 p-1">
                  <button
                    onClick={() => setActiveTab('vuln')}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                      activeTab === 'vuln'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Vulnerability
                  </button>
                  <button
                    onClick={() => setActiveTab('path')}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                      activeTab === 'path'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Attack Path
                  </button>
                  <button
                    onClick={() => setActiveTab('patch')}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                      activeTab === 'patch'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Verified Patch
                  </button>
                  <button
                    onClick={() => setActiveTab('verify')}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                      activeTab === 'verify'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Sandbox Run
                  </button>
                </div>
              </div>

              {/* Tab Contents */}
              <div className="mt-4">
                {activeTab === 'vuln' && (
                  <div className="rounded-lg border border-border/70 bg-muted/40 p-4 font-mono text-xs text-foreground/90 overflow-x-auto">
                    <div className="text-muted-foreground pb-2 text-[11px]"># app/routes/search.py</div>
                    <div className="text-muted-foreground">@app.route(&apos;/search&apos;, methods=[&apos;GET&apos;])</div>
                    <div className="text-muted-foreground">def search_users():</div>
                    <div className="pl-4 text-sky-600 dark:text-sky-400 font-semibold">name = request.args.get(&apos;name&apos;)  # [1] SOURCE: Untrusted input</div>
                    <div className="pl-4 text-amber-600 dark:text-amber-400">sql = f&quot;SELECT * FROM users WHERE name = &apos;{'{name}'}&apos;&quot;  # [2] TRANSFORM</div>
                    <div className="pl-4 text-rose-600 dark:text-rose-400 bg-rose-500/10 -mx-4 px-4 py-1 rounded font-bold">
                      cursor.execute(sql)  # [3] SINK: Dangerous raw execution
                    </div>
                    <div className="pl-4 text-muted-foreground">return jsonify(cursor.fetchall())</div>
                  </div>
                )}

                {activeTab === 'path' && (
                  <div className="space-y-3 py-2">
                    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-bold">1</span>
                      <div>
                        <div className="text-xs font-semibold text-foreground">Entrypoint Source</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">GET /search?name=... (HTTP query param)</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold">2</span>
                      <div>
                        <div className="text-xs font-semibold text-foreground">Taint Propagation</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">build_query(name) concatenates value directly into SQL string</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-rose-500/5 border-rose-500/20 p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold">3</span>
                      <div>
                        <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">Execution Sink</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">cursor.execute(sql) executes unsanitized query against DB</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'patch' && (
                  <div className="rounded-lg border border-border/70 bg-muted/40 p-4 font-mono text-xs overflow-x-auto">
                    <div className="text-muted-foreground pb-2 text-[11px]"># Suggested repair: Parameterize database cursor call</div>
                    <div className="text-rose-600 dark:text-rose-400 bg-rose-500/10 -mx-4 px-4 py-0.5">
                      - sql = f&quot;SELECT * FROM users WHERE name = &apos;{'{name}'}&apos;&quot;
                    </div>
                    <div className="text-rose-600 dark:text-rose-400 bg-rose-500/10 -mx-4 px-4 py-0.5">
                      - cursor.execute(sql)
                    </div>
                    <div className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 -mx-4 px-4 py-0.5 font-semibold">
                      + query = &quot;SELECT * FROM users WHERE name = ?&quot;
                    </div>
                    <div className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 -mx-4 px-4 py-0.5 font-semibold">
                      + cursor.execute(query, (name,))
                    </div>
                  </div>
                )}

                {activeTab === 'verify' && (
                  <div className="rounded-lg border border-border/70 bg-slate-950 p-4 font-mono text-xs text-slate-200 overflow-x-auto">
                    <div className="flex items-center gap-2 text-emerald-400 text-[11px] pb-2 border-b border-slate-800">
                      <Terminal className="h-3.5 w-3.5" />
                      RepoVeriX Sandbox Container (Python 3.11-slim)
                    </div>
                    <div className="mt-2 text-slate-400">$ pytest tests/test_search.py --no-header</div>
                    <div className="text-emerald-400">tests/test_search.py::test_normal_search PASSED [ 33%]</div>
                    <div className="text-emerald-400">tests/test_search.py::test_sqli_payload_escaped PASSED [ 66%]</div>
                    <div className="text-emerald-400">tests/test_search.py::test_empty_param PASSED [100%]</div>
                    <div className="mt-2 text-emerald-300 font-semibold">
                      ✓ 3 passed in 0.28s · Re-analysis: SINK ELIMINATED · Outcome: VERIFIED
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Proof Strip */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 text-foreground font-medium">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Sandbox Tested
                </span>
                <span>•</span>
                <span>Zero Hallucinations</span>
                <span>•</span>
                <span>Zero Breaking Changes</span>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs font-medium gap-1" onClick={() => setActiveTab('verify')}>
                <Play className="h-3 w-3 text-primary fill-primary" />
                Re-run Sandbox Proof
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
