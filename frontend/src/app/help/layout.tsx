import Link from 'next/link';

import { MarketingShell } from '@/components/marketing/marketing-shell';

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingShell>
      <div className="border-b rvx-hairline">
        <div className="mx-auto flex h-12 max-w-6xl items-center gap-4 px-4 text-sm sm:px-6">
          <Link href="/help" className="font-medium text-foreground">
            Help
          </Link>
          <Link href="/docs" className="text-muted-foreground hover:text-foreground">
            Docs
          </Link>
          <Link href="/help/contact" className="text-muted-foreground hover:text-foreground">
            Contact
          </Link>
          <Link href="/help/troubleshooting" className="hidden text-muted-foreground hover:text-foreground sm:inline">
            Troubleshooting
          </Link>
        </div>
      </div>
      <main>{children}</main>
    </MarketingShell>
  );
}
