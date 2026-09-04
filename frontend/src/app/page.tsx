import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  Zap,
  GitBranch,
  Brain,
  Code,
  ArrowRight,
  CheckCircle,
  Github,
} from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">RepoVeriX</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Evidence-Grounded Repository
              <br />
              <span className="text-primary">Auditing & Repair</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
              RepoVeriX combines static analysis, LLM reasoning, and automated verification
              to find and fix bugs with mathematical certainty.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
              <Link href="/signup">
                <Button size="lg" className="gap-2">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/docs">
                <Button size="lg" variant="outline">
                  View Documentation
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: GitBranch,
                title: 'Multi-Source Analysis',
                description: 'Scan GitHub repositories or uploaded ZIP files with support for Python and JavaScript/TypeScript.',
              },
              {
                icon: Brain,
                title: 'LLM-Enhanced Reasoning',
                description: 'GPT-4 powered semantic analysis finds logic bugs and API misuse that static tools miss.',
              },
              {
                icon: Shield,
                title: 'Verified Repairs',
                description: 'Every suggested fix is automatically tested in sandboxed environments before presentation.',
              },
            ].map((feature, index) => (
              <Card key={index} className="border-border/50">
                <CardHeader>
                  <feature.icon className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
            <p className="mt-4 text-muted-foreground">
              A four-stage pipeline ensures every finding is actionable and every fix is verified.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-4">
            {[
              { step: '01', icon: Code, title: 'Ingestion & Parsing', desc: 'Clone repo, parse AST, build symbol table' },
              { step: '02', icon: Zap, title: 'Static Analysis', desc: 'Run SAST tools, build call graphs, track data flow' },
              { step: '03', icon: Brain, title: 'LLM Reasoning', desc: 'Semantic analysis, evidence synthesis, hypothesis generation' },
              { step: '04', icon: CheckCircle, title: 'Verification', desc: 'Auto-generate patches, run tests, verify fixes' },
            ].map((stage, index) => (
              <div key={index} className="relative">
                <div className="absolute left-1/2 top-0 -translate-x-1/2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xl">
                    {stage.step}
                  </div>
                </div>
                <Card className="pt-16">
                  <CardHeader>
                    <stage.icon className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>{stage.title}</CardTitle>
                    <CardDescription>{stage.desc}</CardDescription>
                  </CardHeader>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight">Scan Configurations</h2>
            <p className="mt-4 text-muted-foreground">
              Compare four experimental configurations to find the optimal approach for your codebase.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { name: 'Static Only', config: 'static_only', desc: 'Traditional SAST tools only', color: 'bg-blue-500' },
              { name: 'LLM Only', config: 'llm_only', desc: 'Pure LLM-based analysis', color: 'bg-purple-500' },
              { name: 'Static + LLM', config: 'static_llm', desc: 'Hybrid approach', color: 'bg-orange-500' },
              { name: 'RepoVeriX', config: 'repoverix', desc: 'Full evidence-grounded pipeline', color: 'bg-green-500' },
            ].map((config, index) => (
              <Card key={index} className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 ${config.color}`} />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${config.color}`} />
                    {config.name}
                  </CardTitle>
                  <CardDescription>{config.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/signup?config=${config.config}`}>Try {config.name}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Ready to secure your codebase?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join developers who are catching bugs before they reach production with evidence-grounded analysis.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Link href="/signup">
              <Button size="lg" className="gap-2">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="https://github.com/repoverix" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="gap-2">
                <Github className="h-4 w-4" />
                View on GitHub
              </Button>
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold">RepoVeriX</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Evidence-grounded repository auditing and verified automated repair.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/features" className="hover:text-foreground">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
                <li><Link href="/docs" className="hover:text-foreground">Documentation</Link></li>
                <li><Link href="/api" className="hover:text-foreground">API Reference</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground">About</Link></li>
                <li><Link href="/blog" className="hover:text-foreground">Blog</Link></li>
                <li><Link href="/careers" className="hover:text-foreground">Careers</Link></li>
                <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
                <li><Link href="/security" className="hover:text-foreground">Security</Link></li>
              </ul>
            </div>
          </div>
          <Separator className="my-8" />
          <p className="text-sm text-muted-foreground text-center">
            © 2024 RepoVeriX. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}