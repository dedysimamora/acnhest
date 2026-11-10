"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";
import { InboxIcon, ShieldIcon, TreeIcon, UserIcon } from "./icons";
import { ToastProvider } from "./Toast";

type ShellContext = { me: Me | null; pendingCount: number; refreshPending: () => void };
const Ctx = createContext<ShellContext>({ me: null, pendingCount: 0, refreshPending: () => {} });
export const useShell = () => use(Ctx);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    api<Me>("/api/auth/me").then(setMe).catch(() => {});
  }, []);

  const refreshPending = useCallback(() => {
    if (me?.role !== "admin") return;
    api<{ requests: unknown[] }>("/api/requests?status=pending")
      .then((r) => setPendingCount(r.requests.length))
      .catch(() => {});
  }, [me]);

  useEffect(() => {
    if (me?.role !== "admin") return;
    refreshPending();
    const id = setInterval(refreshPending, 60_000);
    const onFocus = () => refreshPending();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [me, refreshPending]);

  const tabs = [
    { href: "/", label: "Silsilah", icon: TreeIcon },
    { href: "/requests", label: "Pengajuan", icon: InboxIcon },
    ...(me?.role === "admin" ? [{ href: "/admin", label: "Admin", icon: ShieldIcon, badge: pendingCount }] : []),
    { href: "/account", label: "Akun", icon: UserIcon },
  ];

  return (
    <Ctx value={{ me, pendingCount, refreshPending }}>
      <ToastProvider>
        <div className="flex h-dvh flex-col bg-stone-50">
          <main className="relative min-h-0 flex-1 overflow-y-auto">{children}</main>
          <nav
            className="z-30 shrink-0 border-t border-stone-200 bg-white/95 backdrop-blur"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <ul className="mx-auto flex max-w-lg">
              {tabs.map((t) => {
                const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
                const Icon = t.icon;
                return (
                  <li key={t.href} className="flex-1">
                    <Link
                      href={t.href}
                      className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                        active ? "text-emerald-700" : "text-stone-500 hover:text-stone-800"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                          active ? "bg-emerald-100" : ""
                        }`}
                      >
                        <Icon width={22} height={22} />
                      </span>
                      {t.label}
                      {"badge" in t && t.badge ? (
                        <span className="absolute top-1.5 left-1/2 ml-3 min-w-5 rounded-full bg-rose-600 px-1.5 text-center text-[10px] leading-5 font-bold text-white">
                          {t.badge > 99 ? "99+" : t.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </ToastProvider>
    </Ctx>
  );
}
