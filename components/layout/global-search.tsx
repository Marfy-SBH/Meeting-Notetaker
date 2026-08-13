"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatInAppTz } from "@/lib/meeting-grouping";

interface SearchResult {
  id: string;
  title: string;
  date: string | null;
  matches: { type: string; snippet?: string }[];
}

function highlight(text: string, query: string) {
  if (!text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 80);
  const start = Math.max(0, idx - 20);
  const end = Math.min(text.length, idx + query.length + 40);
  const before = text.slice(start, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length, end);
  return (
    <>
      {start > 0 && "…"}
      {before}
      <mark className="rounded bg-warning/30 px-0.5 text-foreground">{match}</mark>
      {after}
      {end < text.length && "…"}
    </>
  );
}

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-24 max-w-lg -translate-y-0 p-0">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search meetings, transcripts, action items…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {loading && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Searching…</p>}
          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results for &quot;{query}&quot;</p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                onOpenChange(false);
                router.push(`/meetings/${r.id}`);
              }}
              className="block w-full rounded-control px-3 py-2.5 text-left hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{r.title}</p>
                {r.date && (
                  <span className="text-xs text-muted-foreground">
                    {formatInAppTz(new Date(r.date), "MMM d, yyyy")}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Matches: {r.matches.map((m) => m.type).join(", ")}
              </p>
              {r.matches[0]?.snippet && (
                <p className="mt-1 truncate text-xs text-foreground/80">
                  {highlight(r.matches[0].snippet, query)}
                </p>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
