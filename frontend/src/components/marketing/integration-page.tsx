import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Check, KeyRound, Lock, RefreshCw, ShieldCheck, FileCode2 } from 'lucide-react';

export interface IntegrationCapability {
  title: string;
  detail: string;
}

export interface IntegrationProvider {
  provider: string;
  headline: string;
  description: string;
  scopes: string[];
  scopesNote: string;
  capabilities: IntegrationCapability[];
  securityPoints: string[];
  setupSteps: string[];
}

export function IntegrationPage({ data }: { data: IntegrationProvider }) {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        {/* Hero */}
        <div className="max-w-3xl">
          <Badge variant="outline" className="text-xs">
            {data.provider} integration
          </Badge>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-balance">
            {data.headline}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{data.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/auth/signup"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Connect {data.provider}
            </Link>
            <Link
              href="/docs/getting-started"
              className="rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              Setup guide
            </Link>
          </div>
        </div>

        {/* Capabilities */}
        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold">What you can do</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {data.capabilities.map((cap) => (
              <Card key={cap.title}>
                <CardContent className="py-5">
                  <p className="flex items-center gap-2 font-medium">
                    <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {cap.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{cap.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Permissions */}
        <section className="mt-14 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="py-6">
              <p className="flex items-center gap-2 font-medium">
                <KeyRound className="h-4 w-4 text-primary" aria-hidden />
                Permissions requested
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.scopes.map((scope) => (
                  <code
                    key={scope}
                    className="rounded-md border bg-muted px-2 py-1 font-mono text-xs"
                  >
                    {scope}
                  </code>
                ))}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{data.scopesNote}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-6">
              <p className="flex items-center gap-2 font-medium">
                <Lock className="h-4 w-4 text-primary" aria-hidden />
                How your credentials are handled
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                {data.securityPoints.map((point) => (
                  <li key={point} className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Setup */}
        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold">Setup</h2>
          <ol className="mt-5 space-y-3">
            {data.setupSteps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-semibold">
                  {i + 1}
                </span>
                <p className="pt-0.5 text-sm leading-relaxed text-muted-foreground">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Cross-links */}
        <section className="mt-14 rounded-2xl border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <RefreshCw className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="font-medium">Keep findings fresh automatically</p>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Add the provided webhook to your repository and every push to the default
                  branch triggers a re-scan — signature-verified and deduplicated.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <FileCode2 className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="font-medium">Export SARIF</p>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Download SARIF 2.1.0 for any scan and upload it to code scanning or open it
                  in your IDE.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
