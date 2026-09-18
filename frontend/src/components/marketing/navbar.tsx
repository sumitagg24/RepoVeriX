"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const LINKS = [
  { label: "Platform", href: "#platform" },
  { label: "How it works", href: "#how" },
  { label: "Evidence", href: "#evidence" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all",
        scrolled
          ? "border-b border-border/70 bg-background/85 backdrop-blur-xl"
          : "bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white dark:bg-white dark:text-black">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="text-[17px] font-extrabold tracking-tight">
            RepoVeriX
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2.5 lg:flex">
          <Link
            href="/auth/login"
            className="rounded-lg px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Log in
          </Link>
          <Button size="sm" className="h-10 px-5" asChild>
            <Link href="/auth/signup">
              Start for free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <button
          className="rounded-lg p-2 hover:bg-secondary lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-border bg-background px-4 pb-5 pt-2 lg:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-3 flex gap-2">
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/auth/login">Log in</Link>
            </Button>
            <Button className="flex-1" asChild>
              <Link href="/auth/signup">Start for free</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
