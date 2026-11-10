"use client";

import { formatDate } from "@/lib/api";
import { cardOrder, countDescendants, yearsLabel, type FamilyIndex } from "@/lib/family";
import type { Person } from "@/lib/types";
import { ChevronRight, EditIcon, HeartIcon, PlusIcon, TrashIcon, UsersIcon, XIcon } from "../icons";
import { Avatar } from "./Avatar";
import type { FormMode } from "./RequestFormSheet";

/**
 * Panel detail di bawah layar (ponsel) / di kanan (desktop). Tidak menutupi seluruh pohon
 * sehingga kotak yang dipilih tetap terlihat di atasnya.
 */
export function PersonPanel({
  person,
  family,
  isAdmin,
  onClose,
  onSelect,
  onForm,
  onDelete,
}: {
  person: Person;
  family: FamilyIndex;
  isAdmin: boolean;
  onClose: () => void;
  onSelect: (personId: number) => void;
  onForm: (mode: FormMode) => void;
  onDelete: (person: Person) => void;
}) {
  const node = family.nodeOfPerson.get(person.id);
  const couple = node ? cardOrder(node).filter((p): p is Person => p != null) : [person];

  const parentUnion = person.parent_union_id ? family.unions.get(person.parent_union_id) : undefined;
  const parents = parentUnion
    ? [parentUnion.partner_a, parentUnion.partner_b].map((id) => (id != null ? family.persons.get(id) : undefined)).filter((p): p is Person => !!p)
    : [];
  const unions = family.unionsByPerson.get(person.id) ?? [];
  const spouses = unions
    .map((u) => (u.partner_a === person.id ? u.partner_b : u.partner_a))
    .map((id) => (id != null ? family.persons.get(id) : undefined))
    .filter((p): p is Person => !!p);
  const children = unions.flatMap((u) => family.childrenByUnion.get(u.id) ?? []);
  const descendants = node && node.person.id === person.id ? countDescendants(node) : null;

  return (
    <aside
      className="animate-sheet absolute inset-x-0 bottom-0 z-20 flex max-h-[62%] flex-col rounded-t-3xl border-t border-stone-200 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] md:inset-x-auto md:top-3 md:right-3 md:bottom-3 md:max-h-none md:w-[380px] md:rounded-3xl md:border"
      aria-label={`Detail ${person.full_name}`}
    >
      <div className="relative shrink-0 px-5 pt-3">
        <div className="mx-auto h-1 w-10 rounded-full bg-stone-300 md:hidden" />
        <button onClick={onClose} className="absolute top-2 right-3 rounded-full p-2 text-stone-500 hover:bg-stone-100" aria-label="Tutup detail">
          <XIcon />
        </button>
        {couple.length > 1 ? (
          <div className="mt-2 flex gap-1 pr-10" role="tablist" aria-label="Pilih orang">
            {couple.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={p.id === person.id}
                onClick={() => onSelect(p.id)}
                className={`min-w-0 truncate rounded-full px-3 py-1.5 text-xs font-semibold ${
                  p.id === person.id ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-600"
                }`}
              >
                {p.full_name.split(" ")[0]}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-5">
        <div className="flex items-center gap-3.5">
          <Avatar person={person} size={56} />
          <div className="min-w-0">
            <h2 className="text-lg leading-snug font-bold text-stone-900">{person.full_name}</h2>
            <p className="text-sm text-stone-500">
              {person.gender === "male" ? "Laki-laki" : "Perempuan"}
              {yearsLabel(person) ? ` · ${yearsLabel(person)}` : ""}
              {person.death_date ? (person.gender === "male" ? " · Alm." : " · Almh.") : ""}
            </p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <Info label="Lahir" value={[person.birth_place, formatDate(person.birth_date)].filter(Boolean).join(", ") || "—"} />
          <Info label="Wafat" value={formatDate(person.death_date) || "—"} />
          {descendants != null ? <Info label="Keturunan" value={`${descendants} orang`} /> : null}
          <Info label="Anak" value={`${children.length} orang`} />
        </dl>
        {person.notes ? <p className="mt-3 rounded-xl bg-stone-50 px-3.5 py-3 text-sm whitespace-pre-line text-stone-700">{person.notes}</p> : null}

        <Relations title="Orang tua" people={parents} onSelect={onSelect} empty="Belum ada data orang tua" />
        <Relations title="Pasangan" people={spouses} onSelect={onSelect} icon={<HeartIcon width={14} height={14} />} />
        <Relations title={`Anak (${children.length})`} people={children} onSelect={onSelect} />

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Action onClick={() => onForm({ kind: "add_child", parent: person })} icon={<PlusIcon width={18} height={18} />} label="Tambah anak" primary />
          <Action onClick={() => onForm({ kind: "add_spouse", person })} icon={<HeartIcon width={18} height={18} />} label="Tambah pasangan" />
          {!person.parent_union_id ? (
            <Action onClick={() => onForm({ kind: "add_parents", person })} icon={<UsersIcon width={18} height={18} />} label="Tambah orang tua" />
          ) : null}
          <Action onClick={() => onForm({ kind: "edit_person", person })} icon={<EditIcon width={18} height={18} />} label="Ubah data" />
          {isAdmin ? (
            <Action onClick={() => onDelete(person)} icon={<TrashIcon width={18} height={18} />} label="Hapus" danger />
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2">
      <dt className="text-[11px] font-medium tracking-wide text-stone-500 uppercase">{label}</dt>
      <dd className="font-medium text-stone-800">{value}</dd>
    </div>
  );
}

function Relations({
  title,
  people,
  onSelect,
  empty,
  icon,
}: {
  title: string;
  people: Person[];
  onSelect: (id: number) => void;
  empty?: string;
  icon?: React.ReactNode;
}) {
  if (!people.length && !empty) return null;
  return (
    <section className="mt-5">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-stone-500 uppercase">
        {icon}
        {title}
      </h3>
      {people.length ? (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200">
          {people.map((p) => (
            <li key={p.id}>
              <button onClick={() => onSelect(p.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-stone-50 active:bg-stone-100">
                <Avatar person={p} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-stone-900">{p.full_name}</span>
                  <span className="block text-xs text-stone-500">{yearsLabel(p) || "—"}</span>
                </span>
                <ChevronRight width={18} height={18} className="text-stone-400" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-400">{empty}</p>
      )}
    </section>
  );
}

function Action({
  onClick,
  icon,
  label,
  primary,
  danger,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold ${
        primary
          ? "bg-emerald-700 text-white hover:bg-emerald-800"
          : danger
            ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            : "border border-stone-200 bg-white text-stone-800 hover:bg-stone-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
