"use client";

import type { Gender, Person } from "@/lib/types";

export type PersonDraft = {
  full_name: string;
  gender: Gender | "";
  birth_date: string;
  death_date: string;
  birth_place: string;
  notes: string;
};

export const emptyDraft = (gender: Gender | "" = ""): PersonDraft => ({
  full_name: "",
  gender,
  birth_date: "",
  death_date: "",
  birth_place: "",
  notes: "",
});

export const draftFromPerson = (p: Person): PersonDraft => ({
  full_name: p.full_name,
  gender: p.gender,
  birth_date: p.birth_date ?? "",
  death_date: p.death_date ?? "",
  birth_place: p.birth_place ?? "",
  notes: p.notes ?? "",
});

export const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-base text-stone-900 outline-none placeholder:text-stone-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";
export const labelCls = "mb-1.5 block text-sm font-medium text-stone-700";

export function PersonFields({
  value,
  onChange,
  idPrefix,
  lockGender,
}: {
  value: PersonDraft;
  onChange: (v: PersonDraft) => void;
  idPrefix: string;
  lockGender?: boolean;
}) {
  const set = <K extends keyof PersonDraft>(k: K, v: PersonDraft[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={`${idPrefix}-name`} className={labelCls}>
          Nama lengkap <span className="text-rose-600">*</span>
        </label>
        <input
          id={`${idPrefix}-name`}
          className={inputCls}
          value={value.full_name}
          onChange={(e) => set("full_name", e.target.value)}
          placeholder="Contoh: Reymond Hans"
          autoComplete="off"
          required
        />
      </div>

      <fieldset>
        <legend className={labelCls}>
          Jenis kelamin <span className="text-rose-600">*</span>
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["male", "Laki-laki"],
              ["female", "Perempuan"],
            ] as const
          ).map(([g, label]) => (
            <button
              type="button"
              key={g}
              disabled={lockGender && value.gender !== g}
              onClick={() => set("gender", g)}
              aria-pressed={value.gender === g}
              className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors disabled:opacity-40 ${
                value.gender === g
                  ? g === "male"
                    ? "border-sky-600 bg-sky-50 text-sky-800"
                    : "border-rose-500 bg-rose-50 text-rose-800"
                  : "border-stone-300 bg-white text-stone-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${idPrefix}-birth`} className={labelCls}>
            Tanggal lahir
          </label>
          <input
            id={`${idPrefix}-birth`}
            type="date"
            className={inputCls}
            value={value.birth_date}
            onChange={(e) => set("birth_date", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-death`} className={labelCls}>
            Tanggal wafat
          </label>
          <input
            id={`${idPrefix}-death`}
            type="date"
            className={inputCls}
            value={value.death_date}
            onChange={(e) => set("death_date", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-place`} className={labelCls}>
          Tempat lahir
        </label>
        <input
          id={`${idPrefix}-place`}
          className={inputCls}
          value={value.birth_place}
          onChange={(e) => set("birth_place", e.target.value)}
          placeholder="Contoh: Bandung"
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-notes`} className={labelCls}>
          Catatan
        </label>
        <textarea
          id={`${idPrefix}-notes`}
          rows={3}
          className={inputCls}
          value={value.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Pekerjaan, kisah singkat, dll."
        />
      </div>
    </div>
  );
}

export const draftToPayload = (d: PersonDraft) => ({
  full_name: d.full_name,
  gender: d.gender || undefined,
  birth_date: d.birth_date || null,
  death_date: d.death_date || null,
  birth_place: d.birth_place || null,
  notes: d.notes || null,
});
