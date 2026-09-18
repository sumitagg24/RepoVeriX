import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function shortId(id?: string | null) {
  if (!id) return "—";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export function severityTone(sev?: string) {
  switch ((sev ?? "").toLowerCase()) {
    case "critical":
      return "bg-red-600 text-white";
    case "high":
      return "bg-orange-500 text-white";
    case "medium":
      return "bg-amber-400 text-stone-950";
    case "low":
      return "bg-sky-500 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function statusTone(status?: string) {
  switch ((status ?? "").toLowerCase()) {
    case "verified":
    case "verified_repair":
    case "completed":
    case "succeeded":
      return "bg-emerald-600 text-white";
    case "probable":
    case "running":
    case "pending":
      return "bg-amber-400 text-stone-950";
    case "rejected":
    case "failed":
    case "repair_failed":
      return "bg-red-600 text-white";
    case "observed":
      return "bg-sky-500 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/** Backend emits pydantic `detail` as string | array — flatten to one line. */
export function apiErrorMessage(err: unknown, fallback = "Request failed") {
  const anyErr = err as {
    response?: { data?: { detail?: unknown } };
    message?: string;
  };
  const detail = anyErr?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) =>
        typeof d === "string"
          ? d
          : d && typeof d === "object"
            ? String((d as { msg?: unknown }).msg ?? "")
            : "",
      )
      .filter(Boolean);
    if (msgs.length) return msgs.join(" · ");
  }
  if (typeof anyErr?.message === "string" && anyErr.message) return anyErr.message;
  return fallback;
}
