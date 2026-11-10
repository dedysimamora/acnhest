"use client";

import { useState } from "react";
import { formatDate } from "@/lib/api";
import type { ChangeRequest, Person } from "@/lib/types";

type PersonPayload = Partial<Pick<Person, "full_name" | "gender" | "birth_date" | "death_date" | "birth_place" | "notes">>;

const statusStyle: Record<ChangeRequest["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
};
const statusLabel: Record<ChangeRequest["status"], string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};

const fields: [keyof PersonPayload, string][] = [
  ["full_name", "Nama"],
  ["gender", "Jenis kelamin"],
  ["birth_date", "Lahir"],
  ["birth_place", "Tempat lahir"],
  ["death_date", "Wafat"],
  ["notes", "Catatan"],
];

const fmt = (k: keyof PersonPayload, v: unknown) => {
  if (v == null || v === "") return "—";
  if (k === "gender") return v === "male" ? "Laki-laki" : "Perempuan";
  if (k === "birth_date" || k === "death_date") return formatDate(String(v));
  return String(v);
};

export function RequestCard({
  req,
  showRequester,
  onReview,
}: {
  req: ChangeRequest;
  showRequester?: boolean;
  onReview?: (decision: "approve" | "reject", note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);

  const people: [string, PersonPayload][] = [];
  const p = req.payload as Record<string, PersonPayload | null>;
  if (p.person) people.push([req.type === "edit_person" ? "Data baru" : "Data", p.person]);
  if (p.father) people.push(["Ayah", p.father]);
  if (p.mother) people.push(["Ibu", p.mother]);

  async function review(decision: "approve" | "reject") {
    if (!onReview) return;
    setBusy(true);
    try {
      await onReview(decision, note);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] leading-snug font-semibold text-stone-900">{req.summary}</h3>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[req.status]}`}>{statusLabel[req.status]}</span>
      </div>
      <p className="mt-1 text-xs text-stone-500">
        {showRequester ? `Oleh ${req.requested_by.name} (@${req.requested_by.username}) · ` : ""}
        {formatDate(req.created_at, true)}
      </p>

      {people.map(([label, person]) => (
        <div key={label} className="mt-3 rounded-xl bg-stone-50 p-3">
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-stone-500 uppercase">{label}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {fields.map(([k, l]) => {
              const before = req.type === "edit_person" && req.target ? req.target[k as keyof Person] : undefined;
              const changed = req.type === "edit_person" && req.target && fmt(k, before) !== fmt(k, person[k]);
              if (!changed && (person[k] == null || person[k] === "") && k !== "full_name") return null;
              return (
                <div key={k} className="contents">
                  <dt className="text-stone-500">{l}</dt>
                  <dd className="min-w-0 break-words text-stone-900">
                    {changed ? (
                      <>
                        <span className="text-stone-400 line-through">{fmt(k, before)}</span> <span className="font-semibold text-emerald-800">{fmt(k, person[k])}</span>
                      </>
                    ) : (
                      fmt(k, person[k])
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}

      {req.status !== "pending" && (req.reviewed_by || req.review_note) ? (
        <p className="mt-3 text-xs text-stone-500">
          {req.reviewed_by ? `Diproses oleh ${req.reviewed_by.name}` : ""}
          {req.reviewed_at ? ` · ${formatDate(req.reviewed_at, true)}` : ""}
          {req.review_note ? <span className="mt-1 block rounded-lg bg-stone-100 px-2.5 py-1.5 text-stone-700">“{req.review_note}”</span> : null}
        </p>
      ) : null}

      {onReview && req.status === "pending" ? (
        <div className="mt-4">
          {rejecting ? (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Alasan penolakan (opsional)"
              className="mb-2 w-full rounded-xl border border-stone-300 px-3 py-2 text-base outline-none focus:border-rose-500"
              autoFocus
            />
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {rejecting ? (
              <>
                <button disabled={busy} onClick={() => setRejecting(false)} className="rounded-xl border border-stone-300 py-2.5 text-sm font-semibold text-stone-700">
                  Batal
                </button>
                <button disabled={busy} onClick={() => review("reject")} className="rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  Tolak
                </button>
              </>
            ) : (
              <>
                <button disabled={busy} onClick={() => setRejecting(true)} className="rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm font-semibold text-rose-700">
                  Tolak
                </button>
                <button disabled={busy} onClick={() => review("approve")} className="rounded-xl bg-emerald-700 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  {busy ? "Memproses…" : "Setujui"}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
