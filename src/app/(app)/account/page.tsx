"use client";

import { api } from "@/lib/api";
import { useShell } from "@/components/AppShell";
import { DownloadIcon, LogoutIcon, UserIcon } from "@/components/icons";

export default function AccountPage() {
  const { me } = useShell();

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    // Muat ulang penuh agar semua state klien milik user ini ikut terhapus.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-8">
      <h1 className="text-2xl font-bold text-stone-900">Akun</h1>
      <section className="mt-4 flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4">
        <span className="rounded-full bg-emerald-100 p-3 text-emerald-700">
          <UserIcon width={28} height={28} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-stone-900">{me?.name ?? "…"}</p>
          <p className="text-sm text-stone-500">
            @{me?.username} · {me?.role === "admin" ? "Admin" : "User"}
          </p>
        </div>
      </section>
      <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="font-semibold text-stone-900">Export data</h2>
        <p className="mt-1 text-sm text-stone-600">
          Unduh seluruh anggota keluarga ke file Excel (.xlsx). Setiap kolom sudah dilengkapi filter.
        </p>
        <a
          href="/api/export"
          download
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 font-semibold text-white hover:bg-emerald-800"
        >
          <DownloadIcon /> Export ke Excel
        </a>
      </section>
      <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
        <h2 className="mb-2 font-semibold text-stone-900">Cara memakai</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Geser dengan satu jari untuk berpindah, cubit dengan dua jari untuk zoom.</li>
          <li>Ketuk kotak seseorang untuk memperbesar dan melihat detailnya.</li>
          <li>Tombol − / + di bawah kotak menyembunyikan atau menampilkan keturunan.</li>
          <li>Mode daftar (ikon ☰) memudahkan menelusuri silsilah besar per generasi.</li>
          {me?.role !== "admin" ? <li>Data yang Anda tambahkan tampil setelah disetujui admin.</li> : null}
        </ul>
      </section>
      <button onClick={logout} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white py-3.5 font-semibold text-rose-700 hover:bg-rose-50">
        <LogoutIcon /> Keluar
      </button>
    </div>
  );
}
