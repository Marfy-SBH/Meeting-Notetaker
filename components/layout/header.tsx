"use client";

import { useState } from "react";
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
import type { Notification } from "@/lib/types";

export function Header({
  userName,
  userEmail,
  avatarUrl,
  notifications,
}: {
  userName: string;
  userEmail: string;
  avatarUrl: string | null;
  notifications: Notification[];
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

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
            <form action={signOut} className="w-full">
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full text-left text-danger">
                  Log out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
