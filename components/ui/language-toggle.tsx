"use client";

import { cn } from "@/lib/utils";

export function LanguageToggle({
  value,
  onChange,
}: {
  value: "bn" | "en";
  onChange: (lang: "bn" | "en") => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-control border border-border bg-white p-1">
      {(["bn", "en"] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => onChange(lang)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium",
            value === lang ? "bg-primary/10 text-primary" : "text-muted-foreground"
          )}
        >
          {lang === "bn" ? "বাংলা" : "English"}
        </button>
      ))}
    </div>
  );
}
