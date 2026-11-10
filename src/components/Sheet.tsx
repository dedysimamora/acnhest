"use client";

import { useEffect, type ReactNode } from "react";
import { XIcon } from "./icons";

/** Bottom sheet modal (di desktop tampil sebagai dialog di tengah). */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Tutup" className="animate-fade absolute inset-0 bg-stone-900/40" onClick={onClose} />
      <div className="animate-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 pt-3 pb-3">
          <div className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-stone-300 sm:hidden" />
          <h2 className="pt-2 text-base font-semibold text-stone-900">{title}</h2>
          <button onClick={onClose} className="mt-1 rounded-full p-2 text-stone-500 hover:bg-stone-100" aria-label="Tutup">
            <XIcon />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer ? (
          <div className="border-t border-stone-100 px-5 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
