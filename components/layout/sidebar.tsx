"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Mic,
  Calendar,
  Plug,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAIN_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/meetings", label: "Meetings", icon: CalendarDays },
  { href: "/live", label: "Live Meeting", icon: Mic },
];

const WORKSPACE_NAV = [
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-gray-100 hover:text-foreground"
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar lg:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-control bg-primary text-primary-foreground">
          <Mic className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">Meeting Note Taker</span>
      </div>

      <nav className="flex flex-1 flex-col gap-6 px-3 py-2">
        <div className="flex flex-col gap-1">
          {MAIN_NAV.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <span className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
            Workspace
          </span>
          {WORKSPACE_NAV.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </div>
      </nav>
    </aside>
  );
}
