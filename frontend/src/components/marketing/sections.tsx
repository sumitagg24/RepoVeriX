import {
  FileCode2,
  FlaskConical,
  GitBranch,
  Github,
  Gitlab,
  ScanSearch,
} from "lucide-react";

const PILLARS = [
  {
    icon: ScanSearch,
    tab: "RepoVeriX / Audit",
    title: "Ship secure code from commit to main",
    desc: "Whole-repo ingestion — GitHub clone or guarded ZIP — with tree-sitter parsing, symbol graphs and deterministic detectors plus ruff/bandit. Reachable risks only.",
    tags: ["SAST", "Secrets", "Deep context", "Python · JS · TS"],
    cta: "Start auditing",
  },
  {
    icon: FileCode2,
    tab: "RepoVeriX / Evidence",
    title: "Every finding carries its proof chain",
    desc: "Source → transform → sink → static → LLM reasoning, ordered and inspectable. VERIFIED / PROBABLE / REJECTED — ungrounded claims never ship.",
    tags: ["Evidence chain", "Call graphs", "Confidence scores", "Zero noise"],
    cta: "See evidence",
  },
  {
    icon: GitBranch,
    tab: "RepoVeriX / Repair",
    title: "Fixes that respect your codebase",
    desc: "Deterministic patch templates first, LLM fallback second. Minimal, style-matched diffs that preserve contracts — never drive-by rewrites.",
    tags: ["Auto-patches", "Unified diffs", "Style-aware", "Human review"],
    cta: "Generate a fix",
  },
  {
    icon: FlaskConical,
    tab: "RepoVeriX / Verify",
    title: "Certified in Docker before you trust it",
    desc: "Patch applied → your tests run → static baseline → finding re-analysed. VERIFIED REPAIR or REPAIR_FAILED. No vibes, just execution.",
    tags: ["Docker sandbox", "pytest · jest", "Re-analysis", "Reports"],
    cta: "Verify a patch",
  },
];

export function Pillars() {
  return (
    <section id="platform" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="eyebrow justify-center text-center">
          <span className="eyebrow-dot" /> One security system
        </p>
        <h2 className="font-display mx-auto mt-3 max-w-3xl text-center text-3xl font-extrabold sm:text-5xl">
          From repo to verified fix, in one flow
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Start where you need. Every module gets security work done
          out-of-the-box, powered by the same repository context. Nothing to
          orchestrate.
        </p>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <article
                key={p.tab}
                className="card-hover rounded-3xl border border-border bg-card p-7 sm:p-9"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-white dark:bg-white dark:text-black">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-secondary px-3 py-1 font-mono text-[11px] font-bold text-muted-foreground">
                    {p.tab}
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-extrabold tracking-tight sm:text-2xl">
                  {p.title}
                </h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
                  {p.desc}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold text-foreground/80"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function Integrations() {
  const items = [
    { icon: Github, label: "GitHub" },
    { icon: Gitlab, label: "GitLab" },
    { icon: FileCode2, label: "Python" },
    { icon: FileCode2, label: "TypeScript" },
    { icon: FlaskConical, label: "pytest · jest" },
  ];
  return (
    <section className="border-y border-border bg-muted/40 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="font-display text-center text-2xl font-extrabold sm:text-3xl">
          Deeply integrated with the tools you already use
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
          Instead of another dashboard to babysit, RepoVeriX meets you in your
          workflow — and only pings you when evidence says it matters.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <span
                key={it.label}
                className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 text-sm font-bold shadow-sm"
              >
                <Icon className="h-4 w-4 text-primary" /> {it.label}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
