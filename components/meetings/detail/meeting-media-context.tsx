"use client";

import { createContext, useContext, useRef, useState, useCallback } from "react";

interface MediaContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  seekTo: (seconds: number) => void;
  registerSeekHandler: (handler: (seconds: number) => void) => void;
}

const MediaContext = createContext<MediaContextValue | null>(null);

export function MeetingMediaProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState("overview");
  const seekHandlerRef = useRef<((seconds: number) => void) | null>(null);
  const pendingSeekRef = useRef<number | null>(null);

  const registerSeekHandler = useCallback((handler: (seconds: number) => void) => {
    seekHandlerRef.current = handler;
    if (pendingSeekRef.current != null) {
      handler(pendingSeekRef.current);
      pendingSeekRef.current = null;
    }
  }, []);

  const seekTo = useCallback((seconds: number) => {
    setActiveTab("recording");
    if (seekHandlerRef.current) seekHandlerRef.current(seconds);
    else pendingSeekRef.current = seconds;
  }, []);

  return (
    <MediaContext.Provider value={{ activeTab, setActiveTab, seekTo, registerSeekHandler }}>
      {children}
    </MediaContext.Provider>
  );
}

export function useMeetingMedia() {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error("useMeetingMedia must be used within MeetingMediaProvider");
  return ctx;
}
