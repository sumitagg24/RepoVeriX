import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PLANS = [
  {
    name: "Starter",
    price: "$0",
    per: "forever",
    desc: "For side projects and first audits.",
    features: ["3 repos", "Full repoverix pipeline", "Evidence chains", "Markdown + JSON reports"],
    featured: false,
  },
  {
    name: "Team",
    price: "$29",
    per: "per dev / mo",
    desc: "For teams shipping every day.",
    features: ["Unlimited repos", "Docker verified repairs", "Priority scans", "Team workspaces", "API access"],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    per: "annual",
    desc: "For regulated, large-scale estates.",
    features: ["SSO / SAML", "Self-hosted runners", "Audit logs", "Custom detectors", "SLA support"],
    featured: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="font-display text-center text-3xl font-extrabold sm:text-5xl">
          Pricing that scales with your code
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Start free. Upgrade when verified repairs become your favourite
          reviewer.
        </p>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={cn(
                "card-hover rounded-3xl border p-8",
                p.featured
                  ? "border-primary/40 bg-black text-white shadow-[0_30px_70px_-25px_rgba(0,0,0,0.6)]"
                  : "border-border bg-card",
              )}
            >
              <p className={cn("text-sm font-extrabold", p.featured ? "text-white" : "")}>{p.name}</p>
              <p className="font-display mt-2 text-4xl font-extrabold">
                {p.price} <span className={cn("text-sm font-semibold", p.featured ? "text-white/60" : "text-muted-foreground")}>{p.per}</span>
              </p>
              <p className={cn("mt-2 text-sm", p.featured ? "text-white/65" : "text-muted-foreground")}>{p.desc}</p>
              <ul className="mt-6 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm font-medium">
                    <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", p.featured ? "bg-emerald-400/20 text-emerald-300" : "bg-emerald-500/15 text-emerald-600")}>
                      <Check className="h-3 w-3" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={p.featured ? "primary" : "outline"}
                className="mt-7 w-full"
                asChild
              >
                <Link href="/auth/signup">
                  {p.featured ? "Start 14-day trial" : "Start for free"} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
