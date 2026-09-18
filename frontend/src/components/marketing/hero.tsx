"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileCode2,
  FlaskConical,
  GitBranch,
  Play,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TABS = [
  { id: "audit", label: "Audit", icon: ScanSearch },
  { id: "evidence", label: "Evidence", icon: FileCode2 },
  { id: "repair", label: "Repair", icon: GitBranch },
  { id: "verify", label: "Verify", icon: FlaskConical },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function Hero() {
  const [tab, setTab] = useState<TabId>("audit");

  return (
    <section className="relative overflow-hidden pt-[68px]">
      {/* grid + glow backdrop */}
      <div className="bg-grid-light mask-fade-y absolute inset-0" aria-hidden />
      <div
        className="absolute -top-32 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]"
        aria-hidden
      />
      <div
        className="absolute left-1/2 top-10 h-40 w-[560px] -translate-x-1/2 rounded-full bg-primary/10 blur-[100px]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-14 text-center sm:px-6 sm:pt-20">
        <Link
          href="#platform"
          className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.07] py-1.5 pl-2 pr-3 text-xs font-bold text-primary shadow-sm backdrop-blur"
        >
          <Badge className="bg-primary text-white">New</Badge>
          Verified Repair Engine 2.0 — every fix certified in Docker
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>

        <h1 className="font-display mx-auto mt-6 max-w-4xl text-[42px] font-extrabold leading-[1.02] sm:text-6xl lg:text-[76px]">
          Secure everything you ship,{" "}
          <span className="bg-gradient-to-r from-primary via-[#ff6a3d] to-primary bg-clip-text text-transparent">
            with proof
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Continuous, evidence-grounded security that gets developers back to
          building. RepoVeriX audits whole repos, shows the exact evidence
          chain, and verifies every patch by running your tests — autonomously.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/auth/signup">
              Start for free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#demo">
              <Play className="h-4 w-4" /> Watch it verify a fix
            </a>
          </Button>
        </div>

        <p className="mt-5 text-[13px] font-medium text-muted-foreground">
          No credit card required <span className="mx-1.5">·</span> Results in
          ~30 sec <span className="mx-1.5">·</span> Trusted by security-minded
          teams
        </p>

        {/* ------- tabbed product visual (Aikido-style hero visual) ------- */}
        <div id="demo" className="mx-auto mt-12 max-w-5xl scroll-mt-24">
          <div className="inline-flex rounded-2xl border border-border bg-card p-1.5 shadow-sm">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all sm:px-6",
                    active
                      ? "bg-black text-white shadow dark:bg-white dark:text-black"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative mt-4 overflow-hidden rounded-3xl border border-border bg-black text-left shadow-[0_40px_90px_-30px_rgba(0,0,0,0.6)]">
            <div className="bg-grid-dark absolute inset-0 opacity-70" aria-hidden />
            <div className="relative">
              <BrowserChrome />
              {tab === "audit" && <AuditPanel />}
              {tab === "evidence" && <EvidencePanel />}
              {tab === "repair" && <RepairPanel />}
              {tab === "verify" && <VerifyPanel />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BrowserChrome() {
  return (
    <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3.5">
      <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
      <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
      <span className="h-3 w-3 rounded-full bg-[#28c840]" />
      <span className="ml-3 hidden rounded-md bg-white/10 px-3 py-1 font-mono text-[11px] text-white/70 sm:block">
        app.repoverix.com/scans/9f3a…/findings
      </span>
      <span className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
        <span className="pulse-soft h-1.5 w-1.5 rounded-full bg-emerald-300" />
        LIVE SCAN
      </span>
    </div>
  );
}

function AuditPanel() {
  const rows = [
    { sev: "bg-red-500", title: "SQL injection in orders.search", file: "api/orders.py:142", status: "VERIFIED", conf: "0.94" },
    { sev: "bg-orange-400", title: "Hardcoded Stripe secret", file: "config/settings.py:18", status: "VERIFIED", conf: "0.99" },
    { sev: "bg-amber-300", title: "Command injection via export", file: "jobs/export.py:67", status: "PROBABLE", conf: "0.81" },
    { sev: "bg-sky-400", title: "Weak hash (md5) for tokens", file: "auth/tokens.py:44", status: "OBSERVED", conf: "0.72" },
  ];
  return (
    <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_300px]">
      <div className="p-5 sm:p-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
          Scan #4821 · repoverix config · 1,284 files · 42s
        </p>
        <div className="mt-4 space-y-2.5">
          {rows.map((r) => (
            <div
              key={r.title}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 backdrop-blur"
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", r.sev)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{r.title}</p>
                <p className="font-mono text-[11px] text-white/50">{r.file}</p>
              </div>
              <span className="hidden rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11px] text-white/70 sm:block">
                {r.conf}
              </span>
              <span className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-emerald-300">
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10 bg-white/[0.03] p-5 sm:p-7 lg:border-l lg:border-t-0">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">Triage</p>
        <p className="font-display mt-2 text-4xl font-extrabold text-white">4 <span className="text-base font-semibold text-white/50">real findings</span></p>
        <p className="mt-2 text-[13px] leading-relaxed text-white/60">312 noisy pattern hits auto-rejected for missing evidence. Zero false-positive triage.</p>
        <div className="mt-4 space-y-2">
          {["Evidence chain attached", "Reachable from user input", "Fix available"].map((t) => (
            <p key={t} className="flex items-center gap-2 text-[13px] font-medium text-white/80">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" /> {t}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function EvidencePanel() {
  const steps = [
    { k: "SOURCE", c: "text-sky-300 border-sky-300/40 bg-sky-300/10", t: "req.query.q flows into orders.search", m: "api/orders.py:131" },
    { k: "SINK", c: "text-red-300 border-red-300/40 bg-red-300/10", t: 'f-string interpolated into cursor.execute', m: "api/orders.py:142" },
    { k: "STATIC", c: "text-violet-300 border-violet-300/40 bg-violet-300/10", t: "RVX-SQLI-01 matched + ruff confirms", m: "rule · high precision" },
    { k: "LLM", c: "text-amber-300 border-amber-300/40 bg-amber-300/10", t: "Reachability confirmed, no sanitizer found", m: "grounded · conf 0.94" },
  ];
  return (
    <div className="grid grid-cols-1 gap-0 lg:grid-cols-[300px_1fr]">
      <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">Evidence chain</p>
        <div className="mt-4 space-y-0">
          {steps.map((s, i) => (
            <div key={s.k} className="relative flex gap-3 pb-5 last:pb-0">
              {i < steps.length - 1 && (
                <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-white/15" />
              )}
              <span className={cn("z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono text-[10px] font-bold", s.c)}>
                {i + 1}
              </span>
              <div>
                <p className={cn("font-mono text-[10px] font-bold tracking-[0.14em]", s.c.split(" ")[0])}>{s.k}</p>
                <p className="mt-0.5 text-[13px] font-medium leading-snug text-white/85">{s.t}</p>
                <p className="font-mono text-[11px] text-white/45">{s.m}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-5 sm:p-7">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/50">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
            <span className="font-mono text-[11px] text-white/50">api/orders.py:138–145</span>
            <span className="rounded bg-red-400/20 px-2 py-0.5 font-mono text-[11px] font-bold text-red-300">sink</span>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed">
            <code>
              <span className="text-white/40">138  </span><span className="text-white/80">def search(q: str):</span>{"\n"}
              <span className="text-white/40">139  </span><span className="text-white/80">    cur = db.cursor()</span>{"\n"}
              <span className="text-white/40">140  </span><span className="text-white/80">    # ❌ untrusted input, no sanitizer</span>{"\n"}
              <span className="bg-red-400/15 text-red-200">142      cur.execute(f&quot;SELECT * FROM orders WHERE id =&apos;{"{q}"}&apos;&quot;)</span>{"\n"}
              <span className="text-white/40">143  </span><span className="text-white/80">    return cur.fetchall()</span>
            </code>
          </pre>
        </div>
        <p className="mt-3 flex items-center gap-2 text-[13px] text-white/60">
          <ShieldCheck className="h-4 w-4 text-emerald-300" /> Ungrounded LLM claims are auto-rejected — only this chain ships.
        </p>
      </div>
    </div>
  );
}

function RepairPanel() {
  return (
    <div className="p-5 sm:p-7">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">Candidate patch · template + LLM fallback</p>
      <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/50 font-mono text-[12px] leading-relaxed">
        <div className="border-b border-white/10 px-4 py-2 text-[11px] text-white/50">api/orders.py — unified diff</div>
        <div className="p-4">
          <p className="text-red-300">-    cur.execute(f&quot;SELECT * FROM orders WHERE id =&apos;{"{q}"}&apos;&quot;)</p>
          <p className="text-emerald-300">+    cur.execute(&quot;SELECT * FROM orders WHERE id = %s&quot;, (q,))</p>
          <p className="mt-2 text-white/45">@@ deterministic template RVX-FIX-SQLI · preserves return contract @@</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {["Style-matched", "Contract-preserving", "Minimal diff"].map((t) => (
          <span key={t} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold text-white/70">{t}</span>
        ))}
      </div>
    </div>
  );
}

function VerifyPanel() {
  const checks = [
    { label: "Patch applied in sandbox", ok: true },
    { label: "pytest · 48 passed, 0 failed", ok: true },
    { label: "ruff baseline clean", ok: true },
    { label: "Original sink no longer detected", ok: true },
  ];
  return (
    <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_300px]">
      <div className="space-y-2.5 p-5 sm:p-7">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] px-4 py-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
            <p className="text-sm font-medium text-white">{c.label}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col justify-center border-t border-white/10 bg-emerald-300/[0.05] p-5 sm:p-7 lg:border-l lg:border-t-0">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-300">Verdict</p>
        <p className="font-display mt-1 text-3xl font-extrabold text-white">VERIFIED REPAIR</p>
        <p className="mt-2 text-[13px] text-white/60">Nothing ships on “AI says so”. Tests, static checks and re-analysis all passed in Docker.</p>
      </div>
    </div>
  );
}
