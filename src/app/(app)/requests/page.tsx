"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ChangeRequest } from "@/lib/types";
import { RequestCard } from "@/components/RequestCard";
import { Segmented } from "@/components/Segmented";

type Filter = "all" | "pending" | "approved" | "rejected";

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<ChangeRequest[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    api<{ requests: ChangeRequest[] }>("/api/requests?scope=mine")
      .then((r) => setRequests(r.requests))
      .catch(() => setRequests([]));
  }, []);

  const shown = (requests ?? []).filter((r) => filter === "all" || r.status === filter);
  const pending = requests?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-8">
      <h1 className="text-2xl font-bold text-stone-900">Pengajuan saya</h1>
      <p className="mt-1 text-sm text-stone-500">Data yang Anda tambahkan masuk ke silsilah setelah disetujui admin.</p>
      <div className="mt-4">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Semua" },
            { value: "pending", label: "Menunggu", count: pending },
            { value: "approved", label: "Disetujui" },
            { value: "rejected", label: "Ditolak" },
          ]}
        />
      </div>
      <div className="mt-4 space-y-3">
        {requests == null ? <p className="py-10 text-center text-stone-500">Memuat…</p> : null}
        {requests && !shown.length ? (
          <p className="rounded-2xl border border-dashed border-stone-300 py-10 text-center text-sm text-stone-500">
            Belum ada pengajuan. Buka tab Silsilah, ketuk seseorang, lalu pilih &ldquo;Tambah anak&rdquo; atau &ldquo;Tambah pasangan&rdquo;.
          </p>
        ) : null}
        {shown.map((r) => (
          <RequestCard key={r.id} req={r} />
        ))}
      </div>
    </div>
  );
}
