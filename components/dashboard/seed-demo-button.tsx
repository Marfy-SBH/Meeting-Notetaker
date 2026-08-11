"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { seedDemoData } from "@/lib/actions/demo";

export function SeedDemoButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => startTransition(() => seedDemoData())}
    >
      <Sparkles className="h-3.5 w-3.5" /> {pending ? "Loading demo data…" : "Load Demo Data"}
    </Button>
  );
}
