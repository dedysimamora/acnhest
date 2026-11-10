"use client";
// Pan & zoom ringan untuk layar sentuh dan desktop:
// - geser 1 jari / drag mouse, cubit 2 jari, ctrl+scroll / pinch trackpad, scroll = geser
// - animateTo() untuk zoom halus ke kotak yang dipilih
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type Transform = { x: number; y: number; k: number };

export const MIN_K = 0.12;
export const MAX_K = 2.5;
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

export function usePanZoom() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const t = useRef<Transform>({ x: 0, y: 0, k: 1 });
  const anim = useRef<number | null>(null);
  // Skala "kasar" untuk React (level detail kartu), tidak di-update setiap frame.
  const [zoomLevel, setZoomLevel] = useState(1);
  const zoomLevelRef = useRef(1);

  const apply = useCallback(() => {
    const { x, y, k } = t.current;
    if (layerRef.current) layerRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${k})`;
    const bucket = k < 0.35 ? 0.3 : k < 0.6 ? 0.5 : 1;
    if (bucket !== zoomLevelRef.current) {
      zoomLevelRef.current = bucket;
      setZoomLevel(bucket);
    }
  }, []);

  const stop = useCallback(() => {
    if (anim.current != null) cancelAnimationFrame(anim.current);
    anim.current = null;
  }, []);

  const set = useCallback(
    (next: Transform) => {
      t.current = { ...next, k: clampK(next.k) };
      apply();
    },
    [apply],
  );

  const animateTo = useCallback(
    (target: Transform, duration = 380) => {
      stop();
      const from = { ...t.current };
      const to = { ...target, k: clampK(target.k) };
      const start = performance.now();
      const ease = (p: number) => 1 - Math.pow(1 - p, 3);
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const e = ease(p);
        t.current = {
          x: from.x + (to.x - from.x) * e,
          y: from.y + (to.y - from.y) * e,
          k: from.k + (to.k - from.k) * e,
        };
        apply();
        anim.current = p < 1 ? requestAnimationFrame(step) : null;
      };
      anim.current = requestAnimationFrame(step);
    },
    [apply, stop],
  );

  /** Zoom dengan titik (px, py) di layar sebagai pusat. */
  const zoomAt = useCallback(
    (factor: number, px: number, py: number, animated = false) => {
      const { x, y, k } = t.current;
      const nk = clampK(k * factor);
      const target = { k: nk, x: px - ((px - x) / k) * nk, y: py - ((py - y) / k) * nk };
      if (animated) animateTo(target, 220);
      else set(target);
    },
    [animateTo, set],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const el = viewportRef.current;
      if (!el) return;
      zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2, true);
    },
    [zoomAt],
  );

  /** Pusatkan persegi (koordinat konten) pada titik layar (cx, cy) dengan skala k. */
  const centerOn = useCallback(
    (rect: { x: number; y: number; w: number; h: number }, k: number, cy?: number, animated = true) => {
      const el = viewportRef.current;
      if (!el) return;
      const nk = clampK(k);
      const screenX = el.clientWidth / 2;
      const screenY = cy ?? el.clientHeight / 2;
      const target = {
        k: nk,
        x: screenX - (rect.x + rect.w / 2) * nk,
        y: screenY - (rect.y + rect.h / 2) * nk,
      };
      if (animated) animateTo(target);
      else set(target);
    },
    [animateTo, set],
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const pointers = new Map<number, { x: number; y: number }>();
    let dragging = false;
    let moved = false;
    let start = { x: 0, y: 0 };
    let pinch: { dist: number; mx: number; my: number } | null = null;

    const local = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const pinchState = () => {
      const [a, b] = [...pointers.values()];
      return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      stop();
      pointers.set(e.pointerId, local(e));
      if (pointers.size === 1) {
        start = local(e);
        moved = false;
        dragging = false;
      }
      if (pointers.size === 2) {
        pinch = pinchState();
        moved = true;
      }
    };

    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = local(e);
      pointers.set(e.pointerId, cur);

      if (pointers.size >= 2 && pinch) {
        const next = pinchState();
        const factor = next.dist / (pinch.dist || 1);
        const { x, y, k } = t.current;
        const nk = clampK(k * factor);
        const real = nk / k;
        t.current = {
          k: nk,
          x: next.mx - (pinch.mx - x) * real,
          y: next.my - (pinch.my - y) * real,
        };
        apply();
        pinch = next;
        return;
      }

      if (!dragging && Math.hypot(cur.x - start.x, cur.y - start.y) > 6) {
        dragging = true;
        moved = true;
        el.setPointerCapture(e.pointerId);
        el.dataset.dragging = "true";
      }
      if (dragging) {
        t.current = { ...t.current, x: t.current.x + cur.x - prev.x, y: t.current.y + cur.y - prev.y };
        apply();
      }
    };

    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 1) {
        // lanjut geser dengan jari yang tersisa
        start = [...pointers.values()][0];
        dragging = true;
      }
      if (pointers.size === 0) {
        dragging = false;
        delete el.dataset.dragging;
      }
    };

    // Batalkan klik setelah drag/pinch supaya kartu tidak ikut terpilih.
    const onClickCapture = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stop();
      const p = local(e);
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.01), p.x, p.y);
      } else {
        t.current = { ...t.current, x: t.current.x - e.deltaX, y: t.current.y - e.deltaY };
        apply();
      }
    };

    // Safari iOS: cegah zoom halaman bawaan ketika mencubit area pohon.
    const prevent = (e: Event) => e.preventDefault();

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("click", onClickCapture, true);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", prevent);
    el.addEventListener("gesturechange", prevent);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("click", onClickCapture, true);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", prevent);
      el.removeEventListener("gesturechange", prevent);
    };
  }, [apply, stop, zoomAt]);

  return useMemo(
    () => ({ viewportRef, layerRef, zoomLevel, set, animateTo, zoomBy, centerOn }),
    [zoomLevel, set, animateTo, zoomBy, centerOn],
  );
}
