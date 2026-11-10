"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { buildFamily, pathToRoot, yearsLabel } from "@/lib/family";
import { computeLayout } from "@/lib/layout";
import type { FamilyData, Person } from "@/lib/types";
import { useShell } from "../AppShell";
import { ListIcon, PlusIcon, SearchIcon, TreeIcon, XIcon } from "../icons";
import { useToast } from "../Toast";
import { Avatar } from "./Avatar";
import { FamilyCanvas, type CanvasHandle } from "./FamilyCanvas";
import { FocusView } from "./FocusView";
import { PersonPanel } from "./PersonPanel";
import { RequestFormSheet, type FormMode } from "./RequestFormSheet";

type View = "tree" | "list";

/**
 * Pohon yang jauh lebih lebar dari layar ponsel dibuka bertahap: cabang mulai generasi ke-3
 * disembunyikan dulu dan bisa dibuka dengan tombol "+N" di bawah kotak.
 */
function initialCollapsed(data: FamilyData): Set<string> {
  const screen = typeof window === "undefined" ? 1024 : window.innerWidth;
  const family = buildFamily(data);
  if (computeLayout(family.roots, new Set()).width <= screen * 3) return new Set();
  const keys = new Set<string>();
  for (const n of family.nodes.values()) if (n.depth === 2 && n.children.length) keys.add(n.key);
  return keys;
}
const VIEW_KEY = "ancestry:view";

export function TreeScreen() {
  const { me } = useShell();
  const toast = useToast();
  const [data, setData] = useState<FamilyData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>("tree");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [form, setForm] = useState<FormMode | null>(null);
  const canvasRef = useRef<CanvasHandle>(null);

  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const fresh = await api<FamilyData>("/api/family");
      if (firstLoad.current) {
        firstLoad.current = false;
        setCollapsed(initialCollapsed(fresh));
      }
      setData(fresh);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat data awal dari BFF
    load();
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "tree" || v === "list") setView(v);
    } catch {}
  }, [load]);

  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  const family = useMemo(() => (data ? buildFamily(data) : null), [data]);
  const layout = useMemo(() => (family ? computeLayout(family.roots, collapsed) : null), [family, collapsed]);

  const selected = selectedId != null ? (family?.persons.get(selectedId) ?? null) : null;
  const selectedNode = selected ? family?.nodeOfPerson.get(selected.id) : undefined;
  const highlightKeys = useMemo(() => new Set(selectedNode ? pathToRoot(selectedNode).map((n) => n.key) : []), [selectedNode]);

  /** Pilih orang, buka panel, dan zoom ke kotaknya (membuka cabang yang tersembunyi bila perlu). */
  const selectPerson = useCallback(
    (personId: number) => {
      const node = family?.nodeOfPerson.get(personId);
      setSelectedId(personId);
      if (!node) return;
      setFocusKey(node.key);
      const hiddenBy = pathToRoot(node)
        .slice(0, -1)
        .filter((n) => collapsed.has(n.key));
      if (hiddenBy.length) {
        setCollapsed((prev) => {
          const next = new Set(prev);
          hiddenBy.forEach((n) => next.delete(n.key));
          return next;
        });
      }
      setPendingFocus(node.key);
    },
    [family, collapsed],
  );

  // Zoom setelah layout terbaru dirender.
  useEffect(() => {
    if (!pendingFocus || view !== "tree") return;
    const id = requestAnimationFrame(() => canvasRef.current?.focusNode(pendingFocus, true));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- permintaan fokus hanya sekali
    setPendingFocus(null);
    return () => cancelAnimationFrame(id);
  }, [pendingFocus, layout, view]);

  const toggleCollapse = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  async function deletePerson(p: Person) {
    if (!confirm(`Hapus ${p.full_name} dari silsilah? Anak-anaknya tetap ada, tetapi hubungan dengan orang ini akan hilang.`)) return;
    try {
      await api(`/api/persons/${p.id}`, { method: "DELETE" });
      toast("Data dihapus");
      setSelectedId(null);
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-stone-600">{loadError}</p>
        <button onClick={load} className="rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white">
          Coba lagi
        </button>
      </div>
    );
  }

  if (!family || !layout) {
    return <div className="flex h-full items-center justify-center text-stone-500">Memuat silsilah…</div>;
  }

  const isAdmin = me?.role === "admin";
  const empty = family.persons.size === 0;

  return (
    <div className="relative h-full">
      {empty ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <span className="rounded-3xl bg-emerald-100 p-5 text-emerald-700">
            <TreeIcon width={40} height={40} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-stone-900">Belum ada data silsilah</h1>
            <p className="mt-1 text-sm text-stone-500">Mulai dengan menambahkan leluhur paling atas yang Anda ketahui.</p>
          </div>
          <button onClick={() => setForm({ kind: "add_root" })} className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white">
            Tambah leluhur pertama
          </button>
        </div>
      ) : view === "tree" ? (
        <FamilyCanvas
          ref={canvasRef}
          layout={layout}
          selectedPersonId={selectedId}
          selectedKey={selectedNode?.key ?? null}
          highlightKeys={highlightKeys}
          onSelectPerson={selectPerson}
          onToggleCollapse={toggleCollapse}
        />
      ) : (
        <div className="h-full overflow-y-auto">
          <FocusView family={family} focusKey={focusKey} onFocus={setFocusKey} onOpenPerson={selectPerson} />
        </div>
      )}

      {!empty ? (
        <TopBar
          persons={[...family.persons.values()]}
          view={view}
          onView={changeView}
          onPick={selectPerson}
          onAddRoot={() => setForm({ kind: "add_root" })}
        />
      ) : null}

      {selected ? (
        <PersonPanel
          person={selected}
          family={family}
          isAdmin={isAdmin}
          onClose={() => setSelectedId(null)}
          onSelect={selectPerson}
          onForm={setForm}
          onDelete={deletePerson}
        />
      ) : null}

      {form ? (
        <RequestFormSheet
          mode={form}
          family={family}
          onClose={() => setForm(null)}
          onDone={(applied) => {
            setForm(null);
            if (applied) load();
          }}
        />
      ) : null}
    </div>
  );
}

function TopBar({
  persons,
  view,
  onView,
  onPick,
  onAddRoot,
}: {
  persons: Person[];
  view: View;
  onView: (v: View) => void;
  onPick: (id: number) => void;
  onAddRoot: () => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return persons.filter((p) => p.full_name.toLowerCase().includes(s)).slice(0, 8);
  }, [q, persons]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3">
      <div className="pointer-events-auto mx-auto flex max-w-2xl items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon width={18} height={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Cari nama…"
            className="h-11 w-full rounded-full border border-stone-200 bg-white/95 pr-9 pl-10 text-base shadow-md outline-none backdrop-blur focus:border-emerald-600"
            aria-label="Cari anggota keluarga"
          />
          {q ? (
            <button onClick={() => setQ("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 text-stone-400" aria-label="Hapus pencarian">
              <XIcon width={16} height={16} />
            </button>
          ) : null}
          {open && results.length ? (
            <ul className="absolute inset-x-0 top-12 max-h-80 overflow-y-auto rounded-2xl border border-stone-200 bg-white py-1 shadow-xl">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      onPick(p.id);
                      setOpen(false);
                      setQ("");
                    }}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-stone-50"
                  >
                    <Avatar person={p} size={32} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{p.full_name}</span>
                      <span className="block text-xs text-stone-500">{yearsLabel(p) || "—"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex h-11 shrink-0 rounded-full border border-stone-200 bg-white p-1 shadow-md" role="group" aria-label="Mode tampilan">
          <button
            onClick={() => onView("tree")}
            aria-pressed={view === "tree"}
            className={`flex items-center rounded-full px-3 ${view === "tree" ? "bg-emerald-700 text-white" : "text-stone-600"}`}
            aria-label="Tampilan pohon"
          >
            <TreeIcon width={18} height={18} />
          </button>
          <button
            onClick={() => onView("list")}
            aria-pressed={view === "list"}
            className={`flex items-center rounded-full px-3 ${view === "list" ? "bg-emerald-700 text-white" : "text-stone-600"}`}
            aria-label="Tampilan daftar"
          >
            <ListIcon width={18} height={18} />
          </button>
        </div>
        <button onClick={onAddRoot} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white shadow-md" aria-label="Tambah leluhur baru">
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}
