"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { TreeIcon } from "./icons";
import { inputCls, labelCls } from "./PersonForm";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const params = useSearchParams();
  const [form, setForm] = useState({ name: "", username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(isLogin ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        json: isLogin ? { username: form.username, password: form.password } : form,
      });
      const next = params.get("next");
      // Muat ulang penuh: state halaman dari sesi sebelumnya (Activity) tidak boleh terbawa.
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center bg-gradient-to-b from-emerald-50 to-stone-50 px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-flex rounded-3xl bg-emerald-700 p-4 text-white shadow-lg">
            <TreeIcon width={32} height={32} />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-stone-900">Silsilah Keluarga</h1>
          <p className="mt-1 text-sm text-stone-500">{isLogin ? "Masuk untuk melihat pohon keluarga" : "Buat akun baru"}</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          {!isLogin ? (
            <div>
              <label htmlFor="name" className={labelCls}>
                Nama lengkap
              </label>
              <input id="name" className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" required />
            </div>
          ) : null}
          <div>
            <label htmlFor="username" className={labelCls}>
              Username
            </label>
            <input
              id="username"
              className={inputCls}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className={labelCls}>
              Password
            </label>
            <input
              id="password"
              type="password"
              className={inputCls}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={isLogin ? undefined : 8}
              required
            />
            {!isLogin ? <p className="mt-1 text-xs text-stone-500">Minimal 8 karakter</p> : null}
          </div>
          {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p> : null}
          <button disabled={busy} className="w-full rounded-xl bg-emerald-700 py-3.5 text-base font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
            {busy ? "Memproses…" : isLogin ? "Masuk" : "Daftar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-600">
          {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
          <Link href={isLogin ? "/register" : "/login"} className="font-semibold text-emerald-700">
            {isLogin ? "Daftar" : "Masuk"}
          </Link>
        </p>
      </div>
    </main>
  );
}
