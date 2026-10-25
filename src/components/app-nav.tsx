"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";

const LINKS = [
  { href: "/#board", label: "Board", match: (path: string) => path === "/" },
  {
    href: "/reminders",
    label: "Reminders",
    match: (path: string) => path.startsWith("/reminders"),
  },
  {
    href: "/calendar",
    label: "Calendar",
    match: (path: string) => path.startsWith("/calendar"),
  },
  {
    href: "/settings",
    label: "Settings",
    match: (path: string) => path.startsWith("/settings"),
  },
] as const;

export function AppNav() {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="flex items-center gap-1 rounded-lg border border-border/70 bg-white/60 p-1 backdrop-blur-sm">
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-ink text-primary-foreground"
                : "text-muted-foreground hover:text-ink"
            }`}
          >
            {link.href === "/settings" && (
              <Settings className="size-3.5 opacity-80" aria-hidden />
            )}
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
