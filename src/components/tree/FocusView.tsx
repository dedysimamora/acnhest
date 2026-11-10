"use client";

// Tampilan "Daftar" ala bagan organisasi Teams: rantai leluhur di atas,
// keluarga yang sedang difokuskan di tengah, dan anak-anak di bawahnya.
import { cardOrder, countDescendants, pathToRoot, yearsLabel, type FamilyIndex, type TreeNode } from "@/lib/family";
import type { Person } from "@/lib/types";
import { ChevronRight, ChevronUp } from "../icons";
import { Avatar } from "./Avatar";

export function FocusView({
  family,
  focusKey,
  onFocus,
  onOpenPerson,
}: {
  family: FamilyIndex;
  focusKey: string | null;
  onFocus: (key: string) => void;
  onOpenPerson: (personId: number) => void;
}) {
  const node = (focusKey && family.nodes.get(focusKey)) || (family.roots.length === 1 ? family.roots[0] : null);

  if (!node) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-20 pb-8">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-stone-500 uppercase">Leluhur ({family.roots.length})</h2>
        <NodeList nodes={family.roots} onFocus={onFocus} />
      </div>
    );
  }

  const chain = pathToRoot(node);
  const ancestors = chain.slice(0, -1);
  const people = cardOrder(node).filter((p): p is Person => p != null);
  const multiUnion = node.spouses.filter((s) => s.person).length > 1;

  return (
    <div className="mx-auto max-w-lg px-4 pt-20 pb-8">
      {ancestors.length ? (
        <ol className="mb-2 space-y-1.5">
          {ancestors.map((a) => (
            <li key={a.key}>
              <button
                onClick={() => onFocus(a.key)}
                className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-left text-sm shadow-sm hover:bg-stone-50"
              >
                <ChevronUp width={16} height={16} className="shrink-0 text-stone-400" />
                <span className="min-w-0 flex-1 truncate font-medium text-stone-700">{coupleName(a)}</span>
                <span className="shrink-0 text-xs text-stone-400">Gen {a.depth + 1}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      {ancestors.length ? <div className="mx-auto h-4 w-0.5 bg-stone-300" /> : null}

      <section className="rounded-3xl border-2 border-emerald-600 bg-white p-4 shadow-md">
        <p className="mb-3 text-center text-xs font-semibold tracking-wide text-emerald-700 uppercase">Generasi {node.depth + 1}</p>
        <div className={`grid gap-3 ${people.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {people.map((p) => (
            <button key={p.id} onClick={() => onOpenPerson(p.id)} className="flex flex-col items-center rounded-2xl bg-stone-50 p-3 text-center hover:bg-stone-100">
              <Avatar person={p} size={52} />
              <span className="mt-2 text-sm leading-tight font-semibold text-stone-900">{p.full_name}</span>
              <span className="mt-0.5 text-xs text-stone-500">{yearsLabel(p) || "—"}</span>
              <span className="mt-2 text-xs font-semibold text-emerald-700">Lihat detail</span>
            </button>
          ))}
        </div>
      </section>

      {node.children.length ? (
        <>
          <div className="mx-auto h-4 w-0.5 bg-stone-300" />
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase">Anak ({node.children.length})</h2>
          {multiUnion
            ? node.spouses
                .filter((s) => node.children.some((c) => c.viaUnionId === s.unionId))
                .map((s) => (
                  <div key={s.unionId} className="mb-3">
                    <p className="mb-1.5 text-xs text-stone-500">Dari {s.person ? s.person.full_name : "pasangan tidak diketahui"}</p>
                    <NodeList nodes={node.children.filter((c) => c.viaUnionId === s.unionId)} onFocus={onFocus} />
                  </div>
                ))
            : <NodeList nodes={node.children} onFocus={onFocus} />}
        </>
      ) : (
        <p className="mt-6 text-center text-sm text-stone-400">Belum ada data anak</p>
      )}
    </div>
  );
}

function coupleName(n: TreeNode) {
  return cardOrder(n)
    .filter((p): p is Person => p != null)
    .map((p) => p.full_name)
    .join(" & ");
}

function NodeList({ nodes, onFocus }: { nodes: TreeNode[]; onFocus: (key: string) => void }) {
  return (
    <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      {nodes.map((c) => {
        const desc = countDescendants(c);
        return (
          <li key={c.key}>
            <button onClick={() => onFocus(c.key)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-stone-50 active:bg-stone-100">
              <span className="flex -space-x-2">
                {cardOrder(c)
                  .filter((p): p is Person => p != null)
                  .slice(0, 2)
                  .map((p) => (
                    <span key={p.id} className="rounded-full ring-2 ring-white">
                      <Avatar person={p} size={36} />
                    </span>
                  ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-stone-900">{c.person.full_name}</span>
                <span className="block truncate text-xs text-stone-500">
                  {c.spouses.find((s) => s.person)?.person ? `& ${c.spouses.find((s) => s.person)!.person!.full_name}` : yearsLabel(c.person) || "—"}
                </span>
              </span>
              {desc ? <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">{desc} ket.</span> : null}
              <ChevronRight width={18} height={18} className="shrink-0 text-stone-400" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
