import * as React from "react";
import { cn } from "@/lib/utils";
import { severityTone, statusTone } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em]",
        className,
      )}
      {...props}
    />
  );
}

export function SeverityBadge({ value }: { value?: string }) {
  return (
    <Badge className={severityTone(value)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span className="capitalize">{value ?? "—"}</span>
    </Badge>
  );
}

export function StatusBadge({ value }: { value?: string }) {
  const label = (value ?? "—").replace(/_/g, " ");
  return (
    <Badge className={statusTone(value)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span className="capitalize">{label}</span>
    </Badge>
  );
}

export function Pill({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
