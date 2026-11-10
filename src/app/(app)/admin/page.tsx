"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatDate } from "@/lib/api";
import type { ChangeRequest } from "@/lib/types";
import { useShell } from "@/components/AppShell";
import { RequestCard } from "@/components/RequestCard";
import { Segmented } from "@/components/Segmented";
import { useToast } from "@/components/Toast";

type Tab = "pending" | "history" | "users";
type UserRow = { id: number; username: string; name: string; role: "admin" | "user"; created_at: string; request_count: number };

export default function AdminPage() {
  const { me, pendingCount, refreshPending } = useShell();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("pending");
  const [requests, setRequests] = useState<ChangeRequest[] | null>(null);
  const [users, setUsers] = useState<UserRow[] | null>(null);

  const load = useCallback(async () => {
    if (tab === "users") {
      const r = await api<{ users: UserRow[] }>("/api/users");
      setUsers(r.users);
    } else {
      const r = await api<{ requests: ChangeRequest[] }>(`/api/requests?scope=all${tab === "pending" ? "&status=pending" : ""}`);
      setRequests(tab === "pending" ? r.requests : r.requests.filter((x) => x.status !== "pending"));
    }
  }, [tab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ambil data dari BFF saat tab berganti
    if (me?.role === "admin") load().catch((e) => toast((e as Error).message, "error"));
  }, [load, me, toast]);

  if (!me) return <p className="py-10 text-center text-stone-500">Memuat…</p>;
  if (me.role !== "admin") return <p className="py-10 text-center text-stone-500">Halaman ini khusus admin.</p>;

  async function review(id: number, decision: "approve" | "reject", note: string) {
    try {
      await api(`/api/requests/${id}`, { method: "PATCH", json: { decision, note } });
      toast(decision === "approve" ? "Disetujui dan masuk ke silsilah" : "Pengajuan ditolak", decision === "approve" ? "success" : "info");
      setRequests((rs) => rs?.filter((r) => r.id !== id) ?? null);
      refreshPending();
    } catch (e) {
      toast((e as Error).message, "error");
      load();
    }
  }

  async function setRole(u: UserRow, role: UserRow["role"]) {
    try {
      await api(`/api/users/${u.id}`, { method: "PATCH", json: { role } });
      setUsers((list) => list?.map((x) => (x.id === u.id ? { ...x, role } : x)) ?? null);
      toast(`${u.name} sekarang ${role === "admin" ? "admin" : "user biasa"}`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-8">
      <h1 className="text-2xl font-bold text-stone-900">Admin</h1>
      <div className="mt-4">
        <Segmented
          value={tab}
          onChange={(t) => {
            setTab(t);
            setRequests(null);
          }}
          options={[
            { value: "pending", label: "Persetujuan", count: pendingCount },
            { value: "history", label: "Riwayat" },
            { value: "users", label: "Pengguna" },
          ]}
        />
      </div>

      {tab !== "users" ? (
        <div className="mt-4 space-y-3">
          {requests == null ? <p className="py-10 text-center text-stone-500">Memuat…</p> : null}
          {requests && !requests.length ? (
            <p className="rounded-2xl border border-dashed border-stone-300 py-10 text-center text-sm text-stone-500">
              {tab === "pending" ? "Tidak ada pengajuan yang menunggu 🎉" : "Belum ada riwayat"}
            </p>
          ) : null}
          {requests?.map((r) => (
            <RequestCard key={r.id} req={r} showRequester onReview={tab === "pending" ? (d, n) => review(r.id, d, n) : undefined} />
          ))}
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {users?.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-stone-900">{u.name}</p>
                <p className="truncate text-xs text-stone-500">
                  @{u.username} · {u.request_count} pengajuan · sejak {formatDate(u.created_at)}
                </p>
              </div>
              <select
                value={u.role}
                disabled={u.id === me.id}
                onChange={(e) => setRole(u, e.target.value as UserRow["role"])}
                className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm disabled:opacity-50"
                aria-label={`Role ${u.name}`}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
