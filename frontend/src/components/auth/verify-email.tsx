"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  MailCheck,
  MailWarning,
  Send,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Shell } from "@/components/auth/forms";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/utils";

export function VerifyEmailContent() {
  const params = useSearchParams();
  const { pendingVerification, verifyEmail, resendVerification } = useAuth();
  const uid = params.get("uid");
  const token = params.get("token");
  const emailParam = params.get("email") ?? "";

  if (uid && token) return <TokenMode uid={uid} token={token} />;
  return <PendingMode emailParam={emailParam} />;
}

function TokenMode({ uid, token }: { uid: string; token: string }) {
  const { verifyEmail } = useAuth();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("Confirming your email…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    verifyEmail(uid, token)
      .then((msg) => {
        setState("done");
        setMessage(msg);
      })
      .catch((e) => {
        setState("error");
        setMessage(
          apiErrorMessage(e, "This link is invalid or has expired."),
        );
      });
  }, [uid, token, verifyEmail]);

  return (
    <Shell
      title="Email verification"
      sub="One click between you and your first audit."
    >
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        {state === "working" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm font-semibold">{message}</p>
          </>
        )}
        {state === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-3 text-[15px] font-bold">You&apos;re verified</p>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
            <Button className="mt-5 w-full" size="lg" asChild>
              <Link href="/auth/login">
                Continue to login <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        )}
        {state === "error" && (
          <>
            <MailWarning className="mx-auto h-10 w-10 text-amber-500" />
            <p className="mt-3 text-[15px] font-bold">Link didn&apos;t work</p>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
            <Button className="mt-5 w-full" size="lg" variant="outline" asChild>
              <Link href="/auth/verify-email">Request a new link</Link>
            </Button>
          </>
        )}
      </div>
    </Shell>
  );
}

function PendingMode({ emailParam }: { emailParam: string }) {
  const { pendingVerification, resendVerification } = useAuth();
  const [email, setEmail] = useState(
    pendingVerification?.email ?? emailParam,
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(
    pendingVerification?.devUrl ?? null,
  );

  useEffect(() => {
    setDevUrl(pendingVerification?.devUrl ?? null);
    if (pendingVerification?.email) setEmail(pendingVerification.email);
  }, [pendingVerification]);

  return (
    <Shell
      title="Check your inbox"
      sub="We sent a verification link. Confirm your email to unlock repositories and scans."
    >
      <div className="rounded-2xl border border-border bg-card p-6">
        <MailCheck className="h-8 w-8 text-primary" />
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          A verification link is on its way to{" "}
          <strong className="text-foreground">{email || "your inbox"}</strong>.
          It expires after 24 hours. Expensive features stay locked until you
          confirm.
        </p>

        {devUrl && (
          <a
            href={devUrl}
            className="mt-4 block rounded-xl border border-dashed border-primary/50 bg-primary/[0.06] px-4 py-3 text-center text-sm font-bold text-primary hover:bg-primary/10"
          >
            Dev shortcut: open verification link
            <span className="block text-[11px] font-medium text-muted-foreground">
              shown because this server prints mail to console (local dev only)
            </span>
          </a>
        )}

        <div className="mt-5">
          <Label htmlFor="verify-email">Email</Label>
          <Input
            id="verify-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>
        <Button
          className="mt-3 w-full"
          variant="outline"
          disabled={busy || !email.trim()}
          onClick={async () => {
            setBusy(true);
            setNote(null);
            try {
              const p = await resendVerification(email.trim());
              setDevUrl(p.devUrl);
              setNote(
                "If an account exists for that address, a fresh link is on its way.",
              );
            } catch (e) {
              setNote(apiErrorMessage(e, "Could not resend right now."));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Send className="h-4 w-4" /> {busy ? "Sending…" : "Resend link"}
        </Button>
        {note && (
          <p className="mt-3 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium">
            {note}
          </p>
        )}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already verified?{" "}
          <Link
            href="/auth/login"
            className="font-bold text-primary hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </Shell>
  );
}

export function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <Shell title="Email verification" sub="One moment…">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </Shell>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
