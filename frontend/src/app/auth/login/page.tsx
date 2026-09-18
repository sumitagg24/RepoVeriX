"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LoginForm } from "@/components/auth/forms";

function LoginWithParams() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const created = params.get("created") === "1";
  return (
    <LoginForm
      initialEmail={email}
      notice={
        created
          ? "Account created. Please log in to continue."
          : null
      }
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin" />}>
      <LoginWithParams />
    </Suspense>
  );
}
