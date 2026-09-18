"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/utils";

export function Shell({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-black text-white lg:block">
        <div className="bg-grid-dark absolute inset-0" aria-hidden />
        <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-primary/30 blur-[110px]" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">RepoVeriX</span>
          </Link>
          <div>
            <p className="font-display text-4xl font-extrabold leading-tight">
              The LLM proposes.<br />
              <span className="text-primary">Evidence verifies.</span>
            </p>
            <div className="mt-8 space-y-3 font-mono text-[12px] text-white/60">
              <p>▸ source → sink traced across your repo</p>
              <p>▸ ungrounded claims auto-rejected</p>
              <p>▸ every fix certified in Docker</p>
            </div>
          </div>
          <p className="text-[13px] text-white/45">© {new Date().getFullYear()} RepoVeriX</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-14 sm:px-10">
        <div className="w-full max-w-[420px]">
          <Link href="/" className="flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">RepoVeriX</span>
          </Link>
          <h1 className="font-display mt-6 text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{sub}</p>
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function LoginForm({
  initialEmail = "",
  notice = null,
}: {
  initialEmail?: string;
  notice?: string | null;
}) {
  const { login } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <Shell title="Welcome back" sub="Log in to continue auditing with proof.">
      {notice && (
        <p className="mb-4 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          {notice}
        </p>
      )}
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await login(email.trim(), password);
          } catch (e2) {
            setErr(apiErrorMessage(e2, "Login failed"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
        </div>
        {err && <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-600">{err}</p>}
        <Button className="w-full" size="lg" disabled={busy}>
          {busy ? "Logging in…" : "Log in"} <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          New here? <Link href="/auth/signup" className="font-bold text-primary hover:underline">Create an account</Link>
        </p>
      </form>
    </Shell>
  );
}

export function SignupForm() {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <Shell title="Start auditing free" sub="No credit card. First verified fix in minutes.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await signup(name.trim(), email.trim(), password);
          } catch (e2) {
            setErr(apiErrorMessage(e2, "Signup failed"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" autoComplete="new-password" />
        </div>
        {err && <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-600">{err}</p>}
        <Button className="w-full" size="lg" disabled={busy}>
          {busy ? "Creating account…" : "Create account"} <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Have an account? <Link href="/auth/login" className="font-bold text-primary hover:underline">Log in</Link>
        </p>
      </form>
    </Shell>
  );
}
