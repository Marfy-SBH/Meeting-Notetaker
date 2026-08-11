"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { List, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

const STATUS_OPTIONS = ["all", "scheduled", "recording", "processing", "completed", "failed", "cancelled"];
const PLATFORM_OPTIONS = ["all", "in_app", "zoom", "google_meet", "other"];

export function MeetingsFilters({ view }: { view: "list" | "calendar" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  function setView(next: "list" | "calendar") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select defaultValue={searchParams.get("range") ?? "all"} onValueChange={(v) => setParam("range", v)}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          {RANGE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select defaultValue={searchParams.get("status") ?? "all"} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o} value={o}>{o === "all" ? "All Statuses" : o[0].toUpperCase() + o.slice(1)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select defaultValue={searchParams.get("platform") ?? "all"} onValueChange={(v) => setParam("platform", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Platform" /></SelectTrigger>
        <SelectContent>
          {PLATFORM_OPTIONS.map((o) => (
            <SelectItem key={o} value={o}>{o === "all" ? "All Platforms" : o.replace("_", " ")}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center gap-1 rounded-control border border-border bg-white p-1">
        <button
          onClick={() => setView("list")}
          className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium", view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground")}
        >
          <List className="h-3.5 w-3.5" /> List
        </button>
        <button
          onClick={() => setView("calendar")}
          className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium", view === "calendar" ? "bg-primary/10 text-primary" : "text-muted-foreground")}
        >
          <CalendarRange className="h-3.5 w-3.5" /> Calendar
        </button>
      </div>
    </div>
  );
}
