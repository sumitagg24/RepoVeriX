'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useFindingChat } from '@/hooks/useAudit';
import type { FindingChatResult } from '@/types/api';
import { Bot, Loader2, Send, Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  'What is this finding about?',
  'Show me the evidence chain',
  'Why does this matter?',
  'How confident is this?',
  'How do I fix it?',
  'Are there similar findings?',
  'Has any patch been verified?',
];

export function FindingChat({ findingId }: { findingId: string }) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<FindingChatResult[]>([]);
  const [useLlm, setUseLlm] = useState(false);
  const chat = useFindingChat();

  const ask = (q: string) => {
    const text = q.trim();
    if (!text || chat.isPending) return;
    chat.mutate(
      { findingId, question: text, useLlm },
      {
        onSuccess: (result) => setHistory((prev) => [result, ...prev]),
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bot className="h-4 w-4 text-primary" /> Ask about this finding
        </CardTitle>
        <CardDescription>
          Questions answered from this finding&apos;s own evidence — what, where, why, confidence,
          similar findings and verification state. Deterministic by default.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.map((entry, i) => (
          <div key={`${entry.question}-${i}`} className="space-y-2">
            <div className="flex items-start justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-2.5">
              <p className="text-sm font-medium">{entry.question}</p>
              <Badge variant="outline" className="shrink-0 capitalize">
                {entry.intent_title} · {entry.mode}
              </Badge>
            </div>
            <div className="whitespace-pre-wrap rounded-xl border bg-card/60 px-4 py-3 font-mono text-[13px] leading-relaxed">
              {entry.answer}
            </div>
          </div>
        ))}
        {history.length === 0 && (
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
        )}
        <div className="space-y-2">
          <Textarea
            placeholder="Ask anything about this finding…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={useLlm}
                onChange={(e) => setUseLlm(e.target.checked)}
                className="accent-primary"
              />
              <Sparkles className="h-3.5 w-3.5" /> LLM upgrade (requires a provider key)
            </label>
            <Button size="sm" onClick={() => ask(question)} disabled={chat.isPending || !question.trim()}>
              {chat.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Ask
            </Button>
          </div>
          {chat.isError && (
            <p className="text-sm text-destructive">
              {(chat.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                (chat.error as Error).message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
