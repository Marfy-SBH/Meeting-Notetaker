"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Sparkles, Archive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTimer } from "@/lib/utils";
import { useMeetingMedia } from "@/components/meetings/detail/meeting-media-context";
import { RECORDING_RETENTION_DAYS } from "@/lib/constants";
import type { ImportantMoment } from "@/lib/types";

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

export function RecordingTab({
  recordingUrl,
  audioDeletedAt,
  moments,
}: {
  recordingUrl: string | null;
  audioDeletedAt?: string | null;
  moments: ImportantMoment[];
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const { registerSeekHandler } = useMeetingMedia();

  useEffect(() => {
    registerSeekHandler((seconds) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = seconds;
      audio.play();
      setPlaying(true);
    });
  }, [registerSeekHandler]);

  if (!recordingUrl) {
    return (
      <div className="flex flex-col gap-5">
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <Archive className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {audioDeletedAt
                ? `Original recording auto-deleted after ${RECORDING_RETENTION_DAYS} days per retention policy.`
                : "Recording is not available."}
            </p>
          </CardContent>
        </Card>
        {moments.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Important Moments</CardTitle></CardHeader>
            <CardContent>
              <ul className="flex flex-col divide-y divide-border">
                {moments.map((m) => (
                  <li key={m.id} className="flex items-start gap-3 py-2.5">
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" /> {formatTimer(m.timestamp)}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.title}</p>
                      {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <audio
            ref={audioRef}
            src={recordingUrl}
            onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onEnded={() => setPlaying(false)}
          />

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const audio = audioRef.current;
                if (!audio) return;
                if (playing) audio.pause();
                else audio.play();
                setPlaying(!playing);
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>

            <span className="w-12 shrink-0 text-xs text-muted-foreground">{formatTimer(current)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={current}
              onChange={(e) => {
                const audio = audioRef.current;
                if (!audio) return;
                audio.currentTime = Number(e.target.value);
                setCurrent(Number(e.target.value));
              }}
              className="h-1.5 flex-1 cursor-pointer accent-primary"
            />
            <span className="w-12 shrink-0 text-xs text-muted-foreground">{formatTimer(duration)}</span>

            <button
              onClick={() => {
                const audio = audioRef.current;
                if (!audio) return;
                audio.muted = !muted;
                setMuted(!muted);
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Speed</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSpeed(s);
                  if (audioRef.current) audioRef.current.playbackRate = s;
                }}
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  speed === s ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-gray-100"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Important Moments</CardTitle></CardHeader>
        <CardContent>
          {moments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No important moments detected yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {moments.map((m) => (
                <li key={m.id} className="flex items-start gap-3 py-2.5">
                  <button
                    onClick={() => {
                      const audio = audioRef.current;
                      if (!audio) return;
                      audio.currentTime = m.timestamp;
                      audio.play();
                      setPlaying(true);
                    }}
                    className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> {formatTimer(m.timestamp)}
                  </button>
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.title}</p>
                    {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
