'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, FolderGit2 } from 'lucide-react';
import { ImportRepositoryPanel } from '@/components/import-repository';

export default function NewRepositoryPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FolderGit2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Import a repository</h1>
          <p className="mt-1 text-muted-foreground">
            Pick a source — GitHub or GitLab with a connected account, an S3 archive link, a git URL, or a local zip upload.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <ImportRepositoryPanel
          onImported={(id) => {
            if (id) router.push(`/scans/new?repo=${id}`);
            else router.push('/repositories');
          }}
        />
      </div>
    </div>
  );
}
