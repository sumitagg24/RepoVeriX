'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useRepoQuery } from '@/hooks/useAudit';
import type { RepositoryQueryResult } from '@/types/api';
import { Bot, CornerDownLeft, Loader2, MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'Where are the code hotspots?',
  'Which files have the worst health?',
  'Who owns the most critical files?',
  'What does app.py do?',
  'How many files and functions are there?',
  'Any findings from the last scan?',
];

export function QueryConsole({ repositoryId }: { repositoryId: string }) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<RepositoryQueryResult[]>([]);
  const [useLlm, setUseLlm] = useState(false);
  const query = useRepoQuery(repositoryId);

  const ask = (q: string) => {
    const text = q.trim();
    if (!text || query.isPending) return;
    query.mutate(
      { question: text, useLlm },
      {
        onSuccess: (result) => {
          setHistory((prev) => [result, ...prev]);
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4 text-primary" /> Ask the repository
          </CardTitle>
          <CardDescription>
            Natural-language questions answered deterministically from the index — health, git,
            call graph, wiki and the latest scan. No LLM required; every answer lists its sources.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Where are the code hotspots?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') ask(question);
              }}
              className="h-10"
            />
            <Button onClick={() => ask(question)} disabled={query.isPending || !question.trim()}>
              {query.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CornerDownLeft className="h-4 w-4" />}
            </Button>
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={useLlm}
              onChange={(e) => setUseLlm(e.target.checked)}
              className="accent-primary"
            />
            <Sparkles className="h-3.5 w-3.5" /> Upgrade open-ended questions with the LLM (requires a provider key)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
          {query.isError && (
            <p className="text-sm text-destructive">
              {(query.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                (query.error as Error).message}
            </p>
          )}
        </CardContent>
      </Card>

      {query.isPending && (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reasoning over the index…
          </CardContent>
        </Card>
      )}

      {history.map((entry, i) => (
        <div key={`${entry.question}-${i}`} className="space-y-2">
          <div className="flex items-start justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-2.5">
            <p className="text-sm font-medium">{entry.question}</p>
            <Badge variant="outline" className="shrink-0 capitalize">
              {entry.intent_title} · {entry.mode}
            </Badge>
          </div>
          <Card>
            <CardContent className="space-y-3 py-4">
              <div className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed">{entry.answer}</div>
              {entry.sources.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <Bot className="h-3 w-3" /> Sources
                  </span>
                  {entry.sources.map((src, si) => (
                    <Badge key={si} variant="secondary" className="font-mono text-[10px]">
                      {src.kind}
                      {src.file && ` · ${src.file}`}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ))}
      {history.length === 0 && !query.isPending && (
        <p className={cn('py-4 text-center text-sm text-muted-foreground')}>
          Try one of the suggestions above, or ask your own question.
        </p>
      )}
    </div>
  );
}
