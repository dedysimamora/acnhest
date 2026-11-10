"use client";

import { memo, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import { cardOrder, yearsLabel, type TreeNode } from "@/lib/family";
import { CARD_H, CARD_W, GAP_Y, type LaidNode, type Layout } from "@/lib/layout";
import { usePanZoom } from "@/hooks/usePanZoom";
import type { Person } from "@/lib/types";
import { FitIcon, LinkIcon, MinusIcon, PlusIcon } from "../icons";
import { Avatar } from "./Avatar";

export type CanvasHandle = {
  /** zoom halus ke kotak node; `sheetOpen` menggeser posisi agar tidak tertutup panel bawah */
  focusNode: (key: string, sheetOpen: boolean) => void;
  fit: () => void;
};

type Props = {
  layout: Layout;
  selectedPersonId: number | null;
  selectedKey: string | null;
  highlightKeys: Set<string>;
  onSelectPerson: (personId: number, nodeKey: string) => void;
  onToggleCollapse: (nodeKey: string) => void;
  ref?: Ref<CanvasHandle>;
};

export function FamilyCanvas({ layout, selectedPersonId, selectedKey, highlightKeys, onSelectPerson, onToggleCollapse, ref }: Props) {
  const { viewportRef, layerRef, zoomLevel, set, zoomBy, centerOn } = usePanZoom();
  const initialized = useRef(false);
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const api = useMemo<CanvasHandle>(() => {
    const fit = () => {
      const el = viewportRef.current;
      const l = layoutRef.current;
      if (!el || !l.nodes.length) return;
      const k = Math.min(el.clientWidth / l.width, el.clientHeight / l.height, 1);
      centerOn({ x: 0, y: 0, w: l.width, h: l.height }, k);
    };
    const focusNode = (key: string, sheetOpen: boolean) => {
      const el = viewportRef.current;
      const laid = layoutRef.current.byKey.get(key);
      if (!el || !laid) return;
      // Kotak mengisi ±80% lebar layar ponsel, tetapi tidak terlalu besar di desktop.
      const k = Math.min(1.35, Math.max(0.8, (el.clientWidth * 0.8) / laid.w));
      const desktop = el.clientWidth >= 768;
      const cy = sheetOpen && !desktop ? el.clientHeight * 0.27 : el.clientHeight / 2;
      centerOn({ x: laid.x, y: laid.y, w: laid.w, h: laid.h }, k, cy);
    };
    return { fit, focusNode };
  }, [viewportRef, centerOn]);
  useImperativeHandle(ref, () => api, [api]);

  // Tampilan awal: muat seluruh pohon bila masih terbaca, kalau tidak mulai dari leluhur paling atas.
  useEffect(() => {
    if (initialized.current || !layout.nodes.length) return;
    const el = viewportRef.current;
    if (!el) return;
    initialized.current = true;
    const fitK = Math.min(el.clientWidth / layout.width, el.clientHeight / layout.height, 1);
    if (fitK >= 0.55) {
      centerOn({ x: 0, y: 0, w: layout.width, h: layout.height }, fitK, undefined, false);
    } else {
      const root = layout.nodes[0];
      const k = Math.min(1, Math.max(0.75, (el.clientWidth * 0.8) / root.w));
      set({ k, x: el.clientWidth / 2 - (root.x + root.w / 2) * k, y: 96 - root.y * k });
    }
  }, [layout, viewportRef, centerOn, set]);

  const lod = zoomLevel; // 1 = lengkap, 0.5 = nama saja, 0.3 = blok warna

  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle,#e7e5e4_1px,transparent_1px)] [background-size:20px_20px]">
      <div ref={viewportRef} className="tree-viewport absolute inset-0" aria-label="Pohon keluarga. Geser untuk berpindah, cubit untuk zoom.">
        <div ref={layerRef} className="absolute top-0 left-0 origin-top-left will-change-transform" style={{ width: layout.width, height: layout.height }}>
          <Connectors layout={layout} highlightKeys={highlightKeys} />
          {layout.nodes.map((n) => (
            <NodeBox
              key={n.node.key}
              laid={n}
              lod={lod}
              selected={selectedKey === n.node.key}
              selectedPersonId={selectedKey === n.node.key ? selectedPersonId : null}
              onSelectPerson={onSelectPerson}
              onToggleCollapse={onToggleCollapse}
            />
          ))}
        </div>
      </div>

      <div className="absolute right-3 bottom-4 z-10 flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-md">
        <button className="p-3 text-stone-700 hover:bg-stone-50 active:bg-stone-100" onClick={() => zoomBy(1.4)} aria-label="Perbesar">
          <PlusIcon />
        </button>
        <button className="border-y border-stone-100 p-3 text-stone-700 hover:bg-stone-50 active:bg-stone-100" onClick={() => zoomBy(1 / 1.4)} aria-label="Perkecil">
          <MinusIcon />
        </button>
        <button className="p-3 text-stone-700 hover:bg-stone-50 active:bg-stone-100" onClick={api.fit} aria-label="Tampilkan seluruh pohon">
          <FitIcon />
        </button>
      </div>
    </div>
  );
}

const Connectors = memo(function Connectors({ layout, highlightKeys }: { layout: Layout; highlightKeys: Set<string> }) {
  const normal: string[] = [];
  const hi: string[] = [];
  for (const e of layout.edges) {
    const px = e.from.x + e.from.w / 2;
    const y1 = e.from.y + e.from.h;
    const midY = y1 + GAP_Y / 2;
    const xs = e.to.map((c) => c.anchorX);
    const minX = Math.min(px, ...xs);
    const maxX = Math.max(px, ...xs);
    normal.push(`M${px} ${y1}V${midY}M${minX} ${midY}H${maxX}`);
    for (const c of e.to) normal.push(`M${c.anchorX} ${midY}V${c.y}`);

    if (highlightKeys.has(e.from.node.key)) {
      const child = e.to.find((c) => highlightKeys.has(c.node.key));
      if (child) hi.push(`M${px} ${y1}V${midY}H${child.anchorX}V${child.y}`);
    }
  }
  return (
    <svg className="pointer-events-none absolute inset-0" width={layout.width} height={layout.height} aria-hidden>
      <path d={normal.join("")} fill="none" stroke="#a8a29e" strokeWidth={2} />
      {hi.length ? <path d={hi.join("")} fill="none" stroke="#047857" strokeWidth={3} strokeLinejoin="round" /> : null}
    </svg>
  );
});

const NodeBox = memo(function NodeBox({
  laid,
  lod,
  selected,
  selectedPersonId,
  onSelectPerson,
  onToggleCollapse,
}: {
  laid: LaidNode;
  lod: number;
  selected: boolean;
  selectedPersonId: number | null;
  onSelectPerson: Props["onSelectPerson"];
  onToggleCollapse: Props["onToggleCollapse"];
}) {
  const { node } = laid;
  const cards = cardOrder(node).filter((p): p is Person => p != null);
  const refIds = new Set(node.spouses.filter((s) => s.ref && s.person).map((s) => s.person!.id));
  const hasChildren = node.children.length > 0;

  return (
    <div className="absolute" style={{ left: laid.x, top: laid.y, width: laid.w, height: laid.h }}>
      <div
        className={`flex h-full overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${
          selected ? "border-emerald-600 shadow-lg ring-4 ring-emerald-600/20" : "border-stone-200"
        }`}
      >
        {cards.map((p, i) => (
          <PersonCard
            key={p.id}
            person={p}
            lod={lod}
            isBlood={p.id === node.person.id}
            isRef={refIds.has(p.id)}
            active={selectedPersonId === p.id}
            divider={i > 0}
            onClick={() => onSelectPerson(p.id, node.key)}
          />
        ))}
      </div>
      {hasChildren ? (
        <button
          onClick={() => onToggleCollapse(node.key)}
          className={`absolute top-full left-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-sm ${
            laid.collapsed ? "border-emerald-700 bg-emerald-700 text-white" : "border-stone-300 bg-white text-stone-600"
          }`}
          aria-label={laid.collapsed ? `Tampilkan ${laid.hiddenCount} keturunan` : "Sembunyikan keturunan"}
        >
          {laid.collapsed ? `+${laid.hiddenCount}` : "−"}
        </button>
      ) : null}
    </div>
  );
});

function PersonCard({
  person,
  lod,
  isBlood,
  isRef,
  active,
  divider,
  onClick,
}: {
  person: Person;
  lod: number;
  isBlood: boolean;
  isRef: boolean;
  active: boolean;
  divider: boolean;
  onClick: () => void;
}) {
  const male = person.gender === "male";
  const stripe = male ? "bg-sky-500" : "bg-rose-400";

  if (lod <= 0.3) {
    return (
      <button onClick={onClick} className={`relative h-full ${divider ? "border-l border-stone-200" : ""}`} style={{ width: CARD_W }} aria-label={person.full_name}>
        <span className={`absolute inset-x-3 top-1/2 h-6 -translate-y-1/2 rounded ${male ? "bg-sky-200" : "bg-rose-200"}`} />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`relative flex h-full flex-col items-center justify-center px-2 text-center transition-colors ${
        divider ? "border-l border-stone-200" : ""
      } ${active ? "bg-emerald-50" : "hover:bg-stone-50"}`}
      style={{ width: CARD_W, height: CARD_H }}
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${stripe} ${isBlood ? "" : "opacity-40"}`} />
      {lod >= 1 ? (
        <>
          <Avatar person={person} size={32} />
          <span className="mt-1 line-clamp-2 text-[12.5px] leading-tight font-semibold text-stone-900">{person.full_name}</span>
          <span className="text-[11px] leading-tight text-stone-500">
            {person.death_date ? "† " : ""}
            {yearsLabel(person)}
          </span>
        </>
      ) : (
        <span className="line-clamp-3 text-[17px] leading-tight font-bold text-stone-900">{person.full_name}</span>
      )}
      {isRef ? (
        <span className="absolute top-1.5 right-1.5 text-stone-400" title="Juga tampil di bagian lain pohon">
          <LinkIcon width={12} height={12} />
        </span>
      ) : null}
    </button>
  );
}

export type { TreeNode };
