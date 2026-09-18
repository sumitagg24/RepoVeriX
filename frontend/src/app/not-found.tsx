import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-7xl font-extrabold text-primary">404</p>
      <h1 className="font-display mt-3 text-2xl font-extrabold">Lost in the repo?</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This path has no evidence attached. Head back to safety.
      </p>
      <Button className="mt-6" asChild>
        <Link href="/">Back home</Link>
      </Button>
    </div>
  );
}
