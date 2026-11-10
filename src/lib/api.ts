"use client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Pemanggil BFF dari browser. Mengarahkan ke /login bila sesi habis. */
export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/api/auth/login")) {
    // Bersihkan cookie kedaluwarsa lalu ke halaman login.
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    const next = window.location.pathname === "/" ? "" : `?next=${encodeURIComponent(window.location.pathname)}`;
    // Muat ulang penuh supaya semua state klien ikut bersih.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login${next}`;
  }
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "Terjadi kesalahan");
  return data as T;
}

export function formatDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
