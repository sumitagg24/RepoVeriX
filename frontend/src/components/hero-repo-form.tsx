'use client';

import { ArrowRight, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Hero repository-URL form. Routes to signup (audits need an account). */
export function HeroRepoForm() {
  return (
    <form
      className="mx-auto mt-9 flex max-w-xl flex-col gap-2 rounded-2xl border bg-card/80 p-2 shadow-md backdrop-blur sm:flex-row sm:rounded-full"
      onSubmit={(e) => {
        e.preventDefault();
        window.location.href = '/auth/signup';
      }}
    >
      <div className="flex flex-1 items-center gap-2 px-3">
        <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          name="url"
          placeholder="Paste a public GitHub repository URL"
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Repository URL"
        />
      </div>
      <Button type="submit" className="h-11 shrink-0 gap-2 sm:rounded-full">
        Explore repository
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}