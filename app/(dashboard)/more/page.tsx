import Link from "next/link";
import { Calendar, Plug, Settings, ChevronRight } from "lucide-react";

const ITEMS = [
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function MorePage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-semibold text-foreground">More</h1>
      <div className="flex flex-col overflow-hidden rounded-card border border-border bg-card">
        {ITEMS.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between px-4 py-3.5 text-sm font-medium text-foreground hover:bg-gray-50 ${
              i !== ITEMS.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <span className="flex items-center gap-3">
              <item.icon className="h-[18px] w-[18px] text-muted-foreground" />
              {item.label}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
