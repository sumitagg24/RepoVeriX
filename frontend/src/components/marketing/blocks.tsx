"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  GitBranch,
  ScanSearch,
  FileSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const AGENTS = [
  {
    icon: ScanSearch,
    name: "Detect-agent",
    task: "deep repo audit · parsing + static analysis",
    state: "complete",
  },
  {
    icon: FileSearch,
    name: "Context-agent",
    task: "building evidence chain · source → sink",
    state: "complete",
  },
  {
    icon: GitBranch,
    name: "Fix-agent",
    task: "creating minimal patch for orders.search",
    state: "running",
  },
  {
    icon: FlaskConical,
    name: "Verify-agent",
    task: "queued · docker sandbox + pytest",
    state: "queued",
  },
];

export function AgentFlow() {
  return (
    <section id="evidence" className="scroll-mt-20 bg-black py-20 text-white sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="eyebrow !text-white/60">
              <span className="eyebrow-dot" /> Security that understands your repo
            </p>
            <h2 className="font-display mt-3 text-3xl font-extrabold sm:text-5xl">
              From found to fixed, autonomously.
            </h2>
            <p className="mt-4 leading-relaxed text-white/65">
              RepoVeriX agents reason across your whole application — parsing
              symbols, tracing calls, grounding every LLM claim in code — then
              prove the fix in an isolated sandbox while you keep building.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/auth/signup">
                  Launch your audit <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 font-mono text-xs text-white/60">
                <Bot className="h-4 w-4" /> 4 agents · 0 setup
              </span>
            </div>
          </div>

          <Card className="min-w-0 border-white/10 bg-white/[0.04] p-5 text-white backdrop-blur sm:p-6">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
                Agents · scan #4821
              </p>
              <p className="font-mono text-[11px] text-white/50">
                <span className="font-bold text-white">128</span> runs ·{" "}
                <span className="text-emerald-300">85 verified</span> ·{" "}
                <span className="text-amber-300">9 running</span>
              </p>
            </div>
            <div className="mt-4 space-y-2.5">
              {AGENTS.map((a) => {
                const Icon = a.icon;
                return (
                  <div
                    key={a.name}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{a.name}</p>
                      <p className="truncate font-mono text-[11px] text-white/50">{a.task}</p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider",
                        a.state === "complete" && "bg-emerald-400/20 text-emerald-300",
                        a.state === "running" && "bg-amber-300/20 text-amber-300",
                        a.state === "queued" && "bg-white/10 text-white/50",
                      )}
                    >
                      {a.state}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-400/10 px-4 py-3 text-[13px] font-medium text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              The LLM proposes; evidence and execution verify. Always.
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Connect a repo",
    desc: "Paste a GitHub URL or drop a ZIP. Guarded ingestion clones into an isolated working copy — your origin is never mutated.",
  },
  {
    n: "02",
    title: "Run the full audit",
    desc: "Pick static_only, llm_only, static_llm or full repoverix. Every stage persists as an AnalysisRun — nothing silently skipped.",
  },
  {
    n: "03",
    title: "Read the evidence",
    desc: "Open a finding: severity, confidence, location, and the ordered chain from untrusted source to dangerous sink.",
  },
  {
    n: "04",
    title: "Ship the verified fix",
    desc: "Generate a minimal patch, verify it in Docker against your tests, download the Markdown report. Done.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="eyebrow"><span className="eyebrow-dot" /> How it works</p>
        <h2 className="font-display mt-3 max-w-2xl text-3xl font-extrabold sm:text-5xl">
          From upload to verified repair in minutes
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="card-hover rounded-3xl border border-border bg-card p-6">
              <p className="font-display text-4xl font-extrabold text-primary/90">{s.n}</p>
              <h3 className="mt-3 font-extrabold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "How is this different from a normal SAST scanner?",
    a: "Scanners emit pattern matches. RepoVeriX requires proof: a reachable path from source to sink, grounded LLM reasoning, and — for fixes — a passing Docker run of your own tests plus re-analysis showing the defect is gone.",
  },
  {
    q: "Do you store or train on my code?",
    a: "No. Repos are analysed in isolated working copies and sandbox containers that are disposed afterwards. Findings and diffs persist; your source never trains models.",
  },
  {
    q: "What languages are supported?",
    a: "Python, JavaScript and TypeScript today — tree-sitter parsing, symbol graphs, and verification runners for pytest and jest. More languages are on the roadmap.",
  },
  {
    q: "What if verification needs Docker?",
    a: "Deterministic analysis and patch generation run anywhere. Only the execution-verification step needs Docker; without it, patches stay CANDIDATE instead of VERIFIED.",
  },
  {
    q: "Can I export a report?",
    a: "Yes — every scan exports structured JSON for research workflows and human-readable Markdown for reviews and audits.",
  },
];

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="font-display text-center text-3xl font-extrabold sm:text-4xl">
          Frequently asked questions
        </h2>
        <div className="mt-10 space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="overflow-hidden rounded-2xl border border-border bg-card">
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-bold"
                >
                  {f.q}
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <p className="px-6 pb-6 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="px-4 pb-20 sm:px-6">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[28px] bg-black px-6 py-16 text-center text-white sm:py-24">
        <div className="bg-grid-dark absolute inset-0" aria-hidden />
        <div className="absolute -top-24 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-primary/25 blur-[100px]" aria-hidden />
        <div className="relative">
          <h2 className="font-display mx-auto max-w-2xl text-3xl font-extrabold sm:text-5xl">
            Get secure today, with proof — not promises.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/65">
            Connect a repo and see what evidence-grounded auditing finds in
            your codebase. Free tier, no credit card, results in ~30 seconds.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/auth/signup">Start for free <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" asChild>
              <a href="#how">See how it works</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="text-[17px] font-extrabold tracking-tight">RepoVeriX</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Evidence-grounded repository auditing and verified automated
            repair. The LLM proposes; evidence and execution verify.
          </p>
        </div>
        {[
          { h: "Platform", links: ["Audit", "Evidence", "Repair", "Verify"] },
          { h: "Resources", links: ["Documentation", "API reference", "Benchmark", "Security"] },
          { h: "Company", links: ["About", "Contact", "Privacy", "Terms"] },
        ].map((col) => (
          <div key={col.h}>
            <p className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">{col.h}</p>
            <ul className="mt-3 space-y-2.5 text-sm font-medium">
              {col.links.map((l) => (
                <li key={l}><span className="cursor-pointer hover:text-primary">{l}</span></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-10 max-w-7xl px-4 text-[13px] text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} RepoVeriX · Research prototype — demo repos are intentionally vulnerable, never deploy them.
      </p>
    </footer>
  );
}
