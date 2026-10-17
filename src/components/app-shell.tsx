"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "./icons";
import type { NavSection } from "@/lib/nav";
import { ROLE_LABELS, Role } from "@/lib/constants";
import { logoutAction } from "@/lib/actions/auth";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function bestMatch(pathname: string, sections: NavSection[]): string | null {
  const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
  let best: string | null = null;
  for (const href of hrefs) {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (!best || href.length > best.length)) best = href;
  }
  return best;
}

export function AppShell({
  sections,
  user,
  unread,
  home,
  children,
}: {
  sections: NavSection[];
  user: { name: string; role: Role; email: string };
  unread: number;
  home: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = bestMatch(pathname, sections);

  const NavList = (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = active === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-brand-50 font-medium text-brand-700"
                        : "text-ink-600 hover:bg-ink-100"
                    }`}
                  >
                    <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const SidebarFooter = (
    <div className="border-t border-ink-100 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-800">{user.name}</p>
          <p className="truncate text-xs text-ink-500">{ROLE_LABELS[user.role]}</p>
        </div>
      </div>
      <form action={logoutAction} className="mt-1">
        <button type="submit" className="btn-ghost w-full justify-start">
          <Icon name="logout" className="h-4 w-4" />
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-ink-100 bg-white lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen">
        <Link href={home} className="flex items-center gap-2 px-4 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Icon name="building" className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-ink-900">Smart Campus</span>
        </Link>
        {NavList}
        {SidebarFooter}
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink-900/40"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[80%] flex-col bg-white shadow-pop">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <span className="text-sm font-semibold text-ink-900">Smart Campus</span>
              <button
                aria-label="Close navigation"
                className="btn-ghost p-2"
                onClick={() => setOpen(false)}
              >
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            {NavList}
            {SidebarFooter}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-100 bg-white/90 px-3 py-2.5 backdrop-blur sm:px-6">
          <button
            className="btn-ghost p-2 lg:hidden"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Icon name="building" className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold text-ink-900">Smart Campus</span>
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link
              href="/notifications"
              className="btn-ghost relative p-2"
              aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
            >
              <Icon name="bell" className="h-5 w-5" />
              {unread > 0 ? (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-semibold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
            <div className="hidden items-center gap-2 rounded-lg border border-ink-200 px-2.5 py-1.5 sm:flex">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[10px] font-semibold text-white">
                {initials(user.name)}
              </span>
              <span className="text-xs font-medium text-ink-700">{user.name}</span>
              <span className="text-[10px] text-ink-400">{ROLE_LABELS[user.role]}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
