"use client";

import { createContext, use, useCallback, useState, type ReactNode } from "react";

type Toast = { id: number; text: string; tone: "success" | "error" | "info" };
const Ctx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => use(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <Ctx value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-toast pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${
              t.tone === "error" ? "bg-rose-600 text-white" : t.tone === "info" ? "bg-stone-800 text-white" : "bg-emerald-700 text-white"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx>
  );
}
