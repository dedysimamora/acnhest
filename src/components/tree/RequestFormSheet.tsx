"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { FamilyIndex } from "@/lib/family";
import type { Person } from "@/lib/types";
import { PersonFields, draftFromPerson, draftToPayload, emptyDraft, labelCls, type PersonDraft } from "../PersonForm";
import { Sheet } from "../Sheet";
import { useShell } from "../AppShell";
import { useToast } from "../Toast";

export type FormMode =
  | { kind: "add_root" }
  | { kind: "add_child"; parent: Person }
  | { kind: "add_spouse"; person: Person }
  | { kind: "add_parents"; person: Person }
  | { kind: "edit_person"; person: Person };

const titles: Record<FormMode["kind"], string> = {
  add_root: "Tambah leluhur",
  add_child: "Tambah anak",
  add_spouse: "Tambah pasangan",
  add_parents: "Tambah orang tua",
  edit_person: "Ubah data",
};

export function RequestFormSheet({
  mode,
  family,
  onClose,
  onDone,
}: {
  mode: FormMode;
  family: FamilyIndex;
  onClose: () => void;
  onDone: (applied: boolean) => void;
}) {
  const { me } = useShell();
  const toast = useToast();
  const isAdmin = me?.role === "admin";

  const initial = (): PersonDraft => {
    if (mode.kind === "edit_person") return draftFromPerson(mode.person);
    if (mode.kind === "add_spouse") return emptyDraft(mode.person.gender === "male" ? "female" : "male");
    return emptyDraft();
  };
  const [draft, setDraft] = useState<PersonDraft>(initial);
  const [father, setFather] = useState<PersonDraft>(emptyDraft("male"));
  const [mother, setMother] = useState<PersonDraft>(emptyDraft("female"));
  const [withFather, setWithFather] = useState(true);
  const [withMother, setWithMother] = useState(true);

  // Untuk "tambah anak": pilih dari pasangan yang mana.
  const parentUnions =
    mode.kind === "add_child"
      ? (family.unionsByPerson.get(mode.parent.id) ?? []).map((u) => {
          const otherId = u.partner_a === mode.parent.id ? u.partner_b : u.partner_a;
          return { id: u.id, other: otherId != null ? (family.persons.get(otherId) ?? null) : null };
        })
      : [];
  const withSpouse = parentUnions.filter((u) => u.other);
  const [unionId, setUnionId] = useState<number | null>(withSpouse[0]?.id ?? null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let body: { type: string; payload: Record<string, unknown> };
    switch (mode.kind) {
      case "add_root":
        body = { type: "add_root", payload: { person: draftToPayload(draft) } };
        break;
      case "add_child":
        body = { type: "add_child", payload: { parent_id: mode.parent.id, union_id: unionId, person: draftToPayload(draft) } };
        break;
      case "add_spouse":
        body = { type: "add_spouse", payload: { person_id: mode.person.id, person: draftToPayload(draft) } };
        break;
      case "edit_person":
        body = { type: "edit_person", payload: { person_id: mode.person.id, person: draftToPayload(draft) } };
        break;
      case "add_parents":
        if (!withFather && !withMother) return setError("Isi minimal ayah atau ibu");
        body = {
          type: "add_parents",
          payload: {
            person_id: mode.person.id,
            father: withFather ? draftToPayload(father) : null,
            mother: withMother ? draftToPayload(mother) : null,
          },
        };
        break;
    }
    setBusy(true);
    try {
      const res = await api<{ status: "approved" | "pending" }>("/api/requests", { method: "POST", json: body });
      if (res.status === "approved") toast("Data tersimpan ke silsilah");
      else toast("Terkirim! Menunggu persetujuan admin", "info");
      onDone(res.status === "approved");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const subject =
    mode.kind === "add_child" ? mode.parent : mode.kind === "add_root" ? null : mode.person;

  return (
    <Sheet
      open
      onClose={onClose}
      title={titles[mode.kind]}
      footer={
        <div className="space-y-2">
          {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          <button
            form="request-form"
            disabled={busy}
            className="w-full rounded-xl bg-emerald-700 py-3.5 text-base font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {busy ? "Menyimpan…" : isAdmin ? "Simpan" : "Kirim untuk disetujui"}
          </button>
        </div>
      }
    >
      <form id="request-form" onSubmit={submit} className="space-y-5">
        {subject ? (
          <p className="rounded-xl bg-stone-100 px-3.5 py-2.5 text-sm text-stone-700">
            {mode.kind === "add_child" && "Anak dari "}
            {mode.kind === "add_spouse" && "Pasangan dari "}
            {mode.kind === "add_parents" && "Orang tua dari "}
            {mode.kind === "edit_person" && "Mengubah data "}
            <strong className="text-stone-900">{subject.full_name}</strong>
          </p>
        ) : null}
        {!isAdmin ? (
          <p className="text-xs text-stone-500">Data akan masuk ke silsilah setelah disetujui admin.</p>
        ) : null}

        {mode.kind === "add_child" && parentUnions.length > 0 ? (
          <fieldset>
            <legend className={labelCls}>Dari pasangan</legend>
            <div className="space-y-2">
              {withSpouse.map((u) => (
                <label key={u.id} className="flex items-center gap-3 rounded-xl border border-stone-300 px-3.5 py-3 has-checked:border-emerald-600 has-checked:bg-emerald-50">
                  <input type="radio" name="union" checked={unionId === u.id} onChange={() => setUnionId(u.id)} className="accent-emerald-700" />
                  <span className="text-sm">
                    {mode.parent.full_name} & <strong>{u.other!.full_name}</strong>
                  </span>
                </label>
              ))}
              <label className="flex items-center gap-3 rounded-xl border border-stone-300 px-3.5 py-3 has-checked:border-emerald-600 has-checked:bg-emerald-50">
                <input type="radio" name="union" checked={unionId === null} onChange={() => setUnionId(null)} className="accent-emerald-700" />
                <span className="text-sm">Pasangan tidak diketahui / orang tua tunggal</span>
              </label>
            </div>
          </fieldset>
        ) : null}

        {mode.kind === "add_parents" ? (
          <>
            <ParentSection title="Ayah" enabled={withFather} onToggle={setWithFather}>
              <PersonFields idPrefix="father" value={father} onChange={setFather} lockGender />
            </ParentSection>
            <ParentSection title="Ibu" enabled={withMother} onToggle={setWithMother}>
              <PersonFields idPrefix="mother" value={mother} onChange={setMother} lockGender />
            </ParentSection>
          </>
        ) : (
          <PersonFields idPrefix="person" value={draft} onChange={setDraft} />
        )}
      </form>
    </Sheet>
  );
}

function ParentSection({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 p-4">
      <label className="flex items-center justify-between">
        <span className="font-semibold text-stone-900">{title}</span>
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="h-5 w-5 accent-emerald-700" />
      </label>
      {enabled ? <div className="mt-4">{children}</div> : <p className="mt-1 text-sm text-stone-500">Tidak diisi</p>}
    </section>
  );
}
