"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Pencil, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";
import { formatTimer, cn } from "@/lib/utils";
import { formatInAppTz } from "@/lib/meeting-grouping";
import { useMeetingMedia } from "@/components/meetings/detail/meeting-media-context";
import { renameSpeaker } from "@/lib/actions/transcript";
import type { TranscriptSegment } from "@/lib/types";

function highlight(text: string, query: string) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded bg-warning/30 px-0.5 text-foreground">{part}</mark>
    ) : (
      part
    )
  );
}

export function TranscriptTab({
  meetingId,
  segments,
  startedAt,
}: {
  meetingId: string;
  segments: TranscriptSegment[];
  startedAt: string | null;
}) {
  const [query, setQuery] = useState("");
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [, startTransition] = useTransition();
  const { seekTo } = useMeetingMedia();

  const filtered = useMemo(() => {
    if (!query) return segments;
    return segments.filter((s) => s.text.toLowerCase().includes(query.toLowerCase()));
  }, [segments, query]);

  const fullText = segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");

  if (segments.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          The full transcript will appear here once processing finishes. There is no live transcript during the meeting.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transcript…"
              className="pl-9"
            />
          </div>
          <CopyButton text={fullText} label="Copy" />
        </div>

        <div className="flex flex-col divide-y divide-border">
          {filtered.map((seg) => {
            const base = startedAt ? new Date(startedAt) : new Date(0);
            const time = new Date(base.getTime() + seg.start_time * 1000);
            const isEditing = editingSpeaker === seg.speaker;

            return (
              <div key={seg.id} className="flex gap-4 py-3">
                <button
                  onClick={() => seekTo(seg.start_time)}
                  className="w-16 shrink-0 text-left text-xs font-medium text-primary hover:underline"
                >
                  {formatTimer(seg.start_time)}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          className="h-7 w-32 text-xs"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            startTransition(() => renameSpeaker(meetingId, seg.speaker, nameInput));
                            setEditingSpeaker(null);
                          }}
                          className="text-success"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditingSpeaker(null)} className="text-muted-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-foreground">{seg.speaker}</span>
                        <button
                          onClick={() => {
                            setEditingSpeaker(seg.speaker);
                            setNameInput(seg.speaker);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Edit speaker"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {startedAt && (
                          <span className="text-xs text-muted-foreground">{formatInAppTz(time, "h:mm:ss a")}</span>
                        )}
                      </>
                    )}
                  </div>
                  <p className={cn("text-sm text-foreground")}>{highlight(seg.text, query)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
