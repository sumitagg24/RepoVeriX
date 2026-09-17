import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Lightbulb, Mail, MessagesSquare } from 'lucide-react';
import { HelpBreadcrumb } from '@/components/help/breadcrumb';

export const metadata: Metadata = {
  title: 'Community - RepoVeriX Help',
};

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <HelpBreadcrumb category="Community" />
      <div className="mt-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Learn together
        </h1>
        <p className="mt-1.5 max-w-2xl text-muted-foreground">
          Ask questions, share audit workflows, and tell us what RepoVeriX should build next.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300">
          <MessagesSquare className="h-6 w-6 text-primary" />
          <h2 className="mt-3 font-semibold">Ask the community</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Public questions and answers about scans, findings, verification and self-hosting
            live on the community boards — search there first, many topics are already covered.
          </p>
          <Link
            href="/contact"
            className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
          >
            Send a question →
          </Link>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300">
          <Mail className="h-6 w-6 text-primary" />
          <h2 className="mt-3 font-semibold">Talk to the team</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            For account or repository-specific help, write to support with your details — a human
            replies within one business day.
          </p>
          <Link
            href="/contact"
            className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
          >
            Contact support →
          </Link>
        </div>
        <div
          id="request-a-feature"
          className="rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300"
        >
          <Lightbulb className="h-6 w-6 text-primary" />
          <h2 className="mt-3 font-semibold">Request a feature</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Suggest and vote on what RepoVeriX builds next. Feature requests are reviewed on the
            roadmap and announced when shipped.
          </p>
          <Link
            href="/contact"
            className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
          >
            Suggest a feature →
          </Link>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300">
          <BookOpen className="h-6 w-6 text-primary" />
          <h2 className="mt-3 font-semibold">Stay up to date</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Product updates land in the docs changelog and on the landing page.
          </p>
          <Link
            href="/docs"
            className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
          >
            Read the docs →
          </Link>
        </div>
      </div>
    </div>
  );
}
