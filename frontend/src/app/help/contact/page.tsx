import type { Metadata } from 'next';
import { Mail, MessageSquare, Clock, LifeBuoy } from 'lucide-react';
import { HelpBreadcrumb } from '@/components/help/breadcrumb';

export const metadata: Metadata = {
  title: 'Contact support - RepoVeriX Help',
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <HelpBreadcrumb category="Contact support" />
      <div className="mt-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Talk to a human
        </h1>
        <p className="mt-1.5 max-w-2xl text-muted-foreground">
          Questions about scans, billing or self-hosting? Include your repository or scan id and
          we’ll get you an answer fast.
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {/* Form column */}
        <div className="lg:col-span-2">
          <ContactForm />
        </div>

        {/* Aside */}
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <Clock className="h-5 w-5 text-primary" />
            <p className="mt-2 font-semibold">Response times</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              We reply within one business day. Team plan requests get a priority queue.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <MessageSquare className="h-5 w-5 text-primary" />
            <p className="mt-2 font-semibold">Prefer the community?</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Many answers already exist there — search before you write.
            </p>
            <a
              href="/community"
              className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
            >
              Visit the community →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactForm() {
  const subject = encodeURIComponent('[RepoVeriX support] ');
  return (
    <form
      className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm"
      action={`mailto:support@repoverix.com?subject=${subject}`}
      method="post"
      encType="text/plain"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Your email</span>
          <input
            type="email"
            required
            name="Email"
            placeholder="you@example.com"
            className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Topic</span>
          <select
            name="Topic"
            className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
          >
            <option>Something isn’t working</option>
            <option>Billing and plans</option>
            <option>Repository import / scan issue</option>
            <option>Security or data question</option>
            <option>Self-hosting / deployment</option>
            <option>Feature request</option>
            <option>Something else</option>
          </select>
        </label>
      </div>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">What’s going on?</span>
        <textarea
          required
          name="Details"
          rows={6}
          placeholder="Include the repository name, scan id, or steps to reproduce. Code snippets help a lot."
          className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
        />
      </label>
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
      >
        <Mail className="h-4 w-4" />
        Send via email
      </button>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <LifeBuoy className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        This opens your email client addressed to our support inbox. For urgent incidents, note
        the account email so we can find your workspace.
      </p>
    </form>
  );
}
