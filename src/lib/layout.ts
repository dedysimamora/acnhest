// Tata letak pohon (atas → bawah) dengan pemadatan kontur sederhana,
// sehingga sub-pohon yang sempit bisa saling merapat dan pohon besar tetap ringkas.
import { cardOrder, type TreeNode } from "./family";

export const CARD_W = 136;
export const CARD_H = 88;
export const GAP_X = 20;
export const GAP_Y = 72;
export const PAD = 48;

export type LaidNode = {
  node: TreeNode;
  x: number; // kiri kotak
  y: number; // atas kotak
  w: number;
  h: number;
  cards: number;
  /** titik x (absolut) tempat garis dari orang tua menempel = tengah kartu keturunan */
  anchorX: number;
  collapsed: boolean;
  hiddenCount: number;
};

export type Edge = { from: LaidNode; to: LaidNode[] };

export type Layout = {
  nodes: LaidNode[];
  byKey: Map<string, LaidNode>;
  edges: Edge[];
  width: number;
  height: number;
};

type Contour = { left: number[]; right: number[] };
type Shape = { offsets: number[]; contour: Contour };

export function cardsOf(node: TreeNode) {
  return cardOrder(node).filter(Boolean).length;
}

function boxWidth(node: TreeNode) {
  const n = cardsOf(node);
  return n * CARD_W + (n - 1) * 4;
}

/** offset x tengah kartu keturunan terhadap tengah kotak */
function anchorOffset(node: TreeNode) {
  const cards = cardOrder(node).filter(Boolean);
  const i = cards.indexOf(node.person);
  const w = boxWidth(node);
  return -w / 2 + i * (CARD_W + 4) + CARD_W / 2;
}

/** Menggabungkan beberapa sub-pohon berdampingan, mengembalikan posisi tengah tiap sub-pohon. */
function packSiblings(contours: Contour[], gap: number): { xs: number[]; merged: Contour } {
  const xs: number[] = [];
  let merged: Contour = { left: [], right: [] };
  contours.forEach((c, idx) => {
    let shift = 0;
    if (idx > 0) {
      shift = -Infinity;
      const levels = Math.min(merged.right.length, c.left.length);
      for (let i = 0; i < levels; i++) shift = Math.max(shift, merged.right[i] - c.left[i] + gap);
      if (shift === -Infinity) shift = 0;
    }
    xs.push(shift);
    const depth = Math.max(merged.left.length, c.left.length);
    const left: number[] = [];
    const right: number[] = [];
    for (let i = 0; i < depth; i++) {
      const hasM = i < merged.left.length;
      const hasC = i < c.left.length;
      left.push(Math.min(hasM ? merged.left[i] : Infinity, hasC ? c.left[i] + shift : Infinity));
      right.push(Math.max(hasM ? merged.right[i] : -Infinity, hasC ? c.right[i] + shift : -Infinity));
    }
    merged = { left, right };
  });
  return { xs, merged };
}

export function computeLayout(roots: TreeNode[], collapsed: Set<string>): Layout {
  const shapes = new Map<string, Shape>();

  // Lintasan 1 (bottom-up): kontur tiap sub-pohon relatif terhadap tengah kotaknya.
  function measure(node: TreeNode): Contour {
    const w = boxWidth(node);
    const children = collapsed.has(node.key) ? [] : node.children;
    if (children.length === 0) {
      shapes.set(node.key, { offsets: [], contour: { left: [-w / 2], right: [w / 2] } });
      return shapes.get(node.key)!.contour;
    }
    const childContours = children.map(measure);
    const { xs, merged } = packSiblings(childContours, GAP_X);
    // Garis turun dari tengah kotak orang tua (di antara suami & istri), jadi kotak
    // diletakkan di tengah rentang titik tempel anak pertama s/d terakhir.
    const firstAnchor = xs[0] + anchorOffset(children[0]);
    const lastAnchor = xs[xs.length - 1] + anchorOffset(children[children.length - 1]);
    const center = (firstAnchor + lastAnchor) / 2;
    const offsets = xs.map((x) => x - center);
    const contour: Contour = {
      left: [-w / 2, ...merged.left.map((v) => v - center)],
      right: [w / 2, ...merged.right.map((v) => v - center)],
    };
    shapes.set(node.key, { offsets, contour });
    return contour;
  }

  const rootContours = roots.map(measure);
  const { xs: rootXs, merged } = packSiblings(rootContours, GAP_X * 4);
  const minX = merged.left.length ? Math.min(...merged.left) : 0;
  const maxX = merged.right.length ? Math.max(...merged.right) : 0;

  const nodes: LaidNode[] = [];
  const byKey = new Map<string, LaidNode>();
  const edges: Edge[] = [];

  // Lintasan 2 (top-down): posisi absolut.
  function place(node: TreeNode, cx: number, depth: number): LaidNode {
    const w = boxWidth(node);
    const isCollapsed = collapsed.has(node.key) && node.children.length > 0;
    const laid: LaidNode = {
      node,
      x: cx - w / 2,
      y: PAD + depth * (CARD_H + GAP_Y),
      w,
      h: CARD_H,
      cards: cardsOf(node),
      anchorX: cx + anchorOffset(node),
      collapsed: isCollapsed,
      hiddenCount: 0,
    };
    nodes.push(laid);
    byKey.set(node.key, laid);
    if (isCollapsed) {
      laid.hiddenCount = countAll(node);
      return laid;
    }
    const shape = shapes.get(node.key)!;
    const kids = node.children.map((c, i) => place(c, cx + shape.offsets[i], depth + 1));
    if (kids.length) edges.push({ from: laid, to: kids });
    return laid;
  }

  roots.forEach((r, i) => place(r, rootXs[i] - minX + PAD, 0));
  const maxDepth = nodes.reduce((m, n) => Math.max(m, n.y), 0);
  return { nodes, byKey, edges, width: maxX - minX + PAD * 2, height: maxDepth + CARD_H + PAD };
}

function countAll(node: TreeNode): number {
  let n = 0;
  for (const c of node.children) n += 1 + countAll(c);
  return n;
}
