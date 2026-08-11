"use client";

import { useTransition } from "react";
import Link from "next/link";
import { format, isToday, isYesterday } from "date-fns";
import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions/notifications";
import type { Notification } from "@/lib/types";

function groupLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d");
}

export function NotificationPanel({ notifications }: { notifications: Notification[] }) {
  const [, startTransition] = useTransition();

  const groups = notifications.reduce<Record<string, Notification[]>>((acc, n) => {
    const key = groupLabel(n.created_at);
    (acc[key] ||= []).push(n);
    return acc;
  }, {});

  return (
    <div className="max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <span className="text-sm font-semibold text-foreground">Notifications</span>
        <button
          onClick={() => startTransition(() => markAllNotificationsRead())}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
        </button>
      </div>

      {notifications.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
      ) : (
        Object.entries(groups).map(([label, items]) => (
          <div key={label}>
            <p className="px-3 pt-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
              {label}
            </p>
            {items.map((n) => (
              <Link
                key={n.id}
                href={n.meeting_id ? `/meetings/${n.meeting_id}` : "#"}
                onClick={() => !n.read && startTransition(() => markNotificationRead(n.id))}
                className={cn(
                  "block px-3 py-2.5 text-sm hover:bg-gray-50",
                  !n.read && "bg-primary/5"
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  <div className={cn(!n.read ? "" : "pl-3.5")}>
                    <p className="font-medium text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                      {format(new Date(n.created_at), "h:mm a")}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
