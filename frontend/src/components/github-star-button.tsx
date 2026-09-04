'use client';

import { useEffect, useState } from 'react';
import { Github, Star } from 'lucide-react';

const REPO = 'sumitagg24/RepoVeriX';

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

/** Live GitHub star count with a graceful fallback when the API is unreachable. */
export function GithubStarButton() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`https://api.github.com/repos/${REPO}`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.stargazers_count === 'number') {
          setCount(data.stargazers_count);
        }
      })
      .catch(() => {
        /* fall back to the plain label */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <a
      href={`https://github.com/${REPO}`}
      target="_blank"
      rel="noopener noreferrer"
      className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
    >
      <Github className="h-4 w-4" />
      <Star className="h-4 w-4 fill-current" />
      <span>
        {count === null ? 'Star' : `Star ${formatCount(count)}`}
      </span>
    </a>
  );
}