"use client";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-2xl bg-stone-200/60 p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl px-2 py-2 text-sm font-semibold transition-colors ${
            value === o.value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600"
          }`}
        >
          {o.label}
          {o.count ? <span className="ml-1 rounded-full bg-amber-200 px-1.5 text-xs text-amber-900">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
