"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Bell } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { NotificationPanel } from "@/components/layout/notification-panel";
import { GlobalSearch } from "@/components/layout/global-search";
import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { playNotificationSound, unlockNotificationSound } from "@/lib/notification-sound";
import type { Notification } from "@/lib/types";

const POLL_INTERVAL_MS = 15_000;

export function Header({
  userName,
  userEmail,
  avatarUrl,
  notifications: initialNotifications,
}: {
  userName: string;
  userEmail: string;
  avatarUrl: string | null;
  notifications: Notification[];
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const seenIds = useRef(new Set(initialNotifications.map((n) => n.id)));
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    setNotifications(initialNotifications);
    initialNotifications.forEach((n) => seenIds.current.add(n.id));
  }, [initialNotifications]);

  useEffect(() => {
    const unlock = () => unlockNotificationSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const supabase = createClient();
    let cancelled = false;

    async function poll() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user || cancelled) return;

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!data || cancelled) return;

      const fresh = data.filter((n) => !seenIds.current.has(n.id));
      if (fresh.length > 0) {
        fresh.forEach((n) => seenIds.current.add(n.id));
        playNotificationSound();
        setNotifications((prev) => {
          const byId = new Map(prev.map((n) => [n.id, n]));
          for (const n of data as Notification[]) byId.set(n.id, n);
          return Array.from(byId.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
      <div>
        <h1 className="text-base font-semibold text-foreground sm:text-lg">Good morning</h1>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Here&apos;s what&apos;s happening with your meetings.
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-control text-muted-foreground hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:w-56 sm:justify-start sm:gap-2 sm:border sm:border-border sm:bg-white sm:px-3"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
          <span className="hidden text-sm sm:inline">Search meetings…</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="relative flex h-10 w-10 items-center justify-center rounded-control text-muted-foreground hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <NotificationPanel notifications={notifications} />
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label="Account menu">
              <Avatar name={userName} src={avatarUrl} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <p className="font-medium text-foreground">{userName}</p>
              <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-danger"
              onSelect={() => {
                // A native <form action={signOut}> submit button inside a Radix
                // DropdownMenuItem is unreliable — Radix closes (unmounts, via
                // Portal) the menu on selection, which can cancel the form
                // submission before it completes. Invoking the action directly
                // sidesteps that entirely.
                void signOut();
              }}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
