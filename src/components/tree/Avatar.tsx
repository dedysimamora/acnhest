import type { Person } from "@/lib/types";

export function initials(name: string) {
  const parts = name
    .replace(/^(H|Hj|Dr|Ir|Prof)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ person, size = 40 }: { person: Person; size?: number }) {
  const male = person.gender === "male";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${
        male ? "bg-sky-100 text-sky-800" : "bg-rose-100 text-rose-800"
      } ${person.death_date ? "opacity-70 grayscale-[40%]" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(person.full_name)}
    </span>
  );
}
