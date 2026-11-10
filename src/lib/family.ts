// Menyusun data mentah (persons + unions) menjadi pohon keturunan.
// Satu node = satu orang dari garis keturunan + pasangan-pasangannya (dalam satu kotak).
import type { FamilyData, Person, Union } from "./types";

export type SpouseLink = {
  unionId: number;
  /** null = orang tua tunggal / pasangan tidak diketahui */
  person: Person | null;
  /** true jika pasangan ini sudah tampil di bagian lain pohon (mis. sesama keturunan menikah) */
  ref: boolean;
};

export type TreeNode = {
  key: string;
  person: Person;
  spouses: SpouseLink[];
  children: TreeNode[];
  /** union orang tua yang melahirkan node ini (untuk label jika orang tua punya >1 pasangan) */
  viaUnionId: number | null;
  depth: number;
  parent: TreeNode | null;
};

export type FamilyIndex = {
  persons: Map<number, Person>;
  unions: Map<number, Union>;
  unionsByPerson: Map<number, Union[]>;
  childrenByUnion: Map<number, Person[]>;
  /** node tempat seseorang tampil (sebagai keturunan atau sebagai pasangan) */
  nodeOfPerson: Map<number, TreeNode>;
  nodes: Map<string, TreeNode>;
  roots: TreeNode[];
};

const byBirth = (a: Person, b: Person) =>
  (a.birth_date ?? "9999").localeCompare(b.birth_date ?? "9999") || a.id - b.id;

export function buildFamily(data: FamilyData): FamilyIndex {
  const persons = new Map(data.persons.map((p) => [p.id, p]));
  const unions = new Map(data.unions.map((u) => [u.id, u]));
  const unionsByPerson = new Map<number, Union[]>();
  const childrenByUnion = new Map<number, Person[]>();

  for (const u of data.unions) {
    for (const pid of [u.partner_a, u.partner_b]) {
      if (pid == null) continue;
      if (!unionsByPerson.has(pid)) unionsByPerson.set(pid, []);
      unionsByPerson.get(pid)!.push(u);
    }
  }
  for (const p of data.persons) {
    if (p.parent_union_id == null || !unions.has(p.parent_union_id)) continue;
    if (!childrenByUnion.has(p.parent_union_id)) childrenByUnion.set(p.parent_union_id, []);
    childrenByUnion.get(p.parent_union_id)!.push(p);
  }
  for (const list of childrenByUnion.values()) list.sort(byBirth);

  const visitedPersons = new Set<number>();
  const visitedUnions = new Set<number>();
  const nodeOfPerson = new Map<number, TreeNode>();
  const nodes = new Map<string, TreeNode>();

  const hasParents = (p: Person) => p.parent_union_id != null && unions.has(p.parent_union_id);

  function build(person: Person, depth: number, parent: TreeNode | null, viaUnionId: number | null): TreeNode {
    visitedPersons.add(person.id);
    const node: TreeNode = { key: `p${person.id}`, person, spouses: [], children: [], viaUnionId, depth, parent };
    nodes.set(node.key, node);
    nodeOfPerson.set(person.id, node);

    const myUnions = unionsByPerson.get(person.id) ?? [];
    const pending: Union[] = [];
    for (const u of myUnions) {
      const otherId = u.partner_a === person.id ? u.partner_b : u.partner_a;
      const other = otherId != null ? (persons.get(otherId) ?? null) : null;
      if (visitedUnions.has(u.id)) {
        node.spouses.push({ unionId: u.id, person: other, ref: true });
        continue;
      }
      visitedUnions.add(u.id);
      // Pasangan yang juga keturunan dan sudah tampil di tempat lain → tampil sebagai rujukan.
      const ref = other != null && visitedPersons.has(other.id);
      if (other && !ref) {
        visitedPersons.add(other.id);
        nodeOfPerson.set(other.id, node);
      }
      node.spouses.push({ unionId: u.id, person: other, ref });
      pending.push(u);
    }
    // Tampilkan pasangan "tunggal" (tanpa pasangan) di akhir.
    node.spouses.sort((a, b) => Number(a.person == null) - Number(b.person == null));

    for (const u of pending) {
      for (const child of childrenByUnion.get(u.id) ?? []) {
        if (visitedPersons.has(child.id)) continue;
        node.children.push(build(child, depth + 1, node, u.id));
      }
    }
    return node;
  }

  // Leluhur: tidak punya orang tua, dan pasangannya pun tidak punya orang tua
  // (kalau pasangannya punya, ia akan tampil sebagai pasangan di pohon keluarga lain).
  const rootCandidates = data.persons
    .filter((p) => !hasParents(p))
    .filter((p) =>
      (unionsByPerson.get(p.id) ?? []).every((u) => {
        const o = u.partner_a === p.id ? u.partner_b : u.partner_a;
        const op = o != null ? persons.get(o) : undefined;
        return !op || !hasParents(op);
      }),
    )
    .sort((a, b) => {
      // Utamakan yang punya keturunan paling banyak, lalu laki-laki, lalu yang lahir lebih awal.
      const kids = (p: Person) =>
        (unionsByPerson.get(p.id) ?? []).reduce((n, u) => n + (childrenByUnion.get(u.id)?.length ?? 0), 0);
      return kids(b) - kids(a) || Number(a.gender === "female") - Number(b.gender === "female") || byBirth(a, b);
    });

  const roots: TreeNode[] = [];
  for (const p of rootCandidates) if (!visitedPersons.has(p.id)) roots.push(build(p, 0, null, null));
  // Data yang tidak terjangkau (mis. siklus) tetap ditampilkan sebagai akar tersendiri.
  for (const p of [...data.persons].sort(byBirth)) if (!visitedPersons.has(p.id)) roots.push(build(p, 0, null, null));

  return { persons, unions, unionsByPerson, childrenByUnion, nodeOfPerson, nodes, roots };
}

/** Rantai leluhur dari akar sampai node (termasuk node itu sendiri). */
export function pathToRoot(node: TreeNode): TreeNode[] {
  const chain: TreeNode[] = [];
  for (let n: TreeNode | null = node; n; n = n.parent) chain.unshift(n);
  return chain;
}

export function countDescendants(node: TreeNode): number {
  let n = 0;
  for (const c of node.children) n += 1 + countDescendants(c);
  return n;
}

export function yearsLabel(p: Person): string {
  const b = p.birth_date?.slice(0, 4);
  const d = p.death_date?.slice(0, 4);
  if (b && d) return `${b} – ${d}`;
  if (b) return `l. ${b}`;
  if (d) return `w. ${d}`;
  return "";
}

/** Urutan kartu dalam satu kotak: suami di kiri, istri di kanan. */
export function cardOrder(node: TreeNode): (Person | null)[] {
  const spouses = node.spouses.map((s) => s.person);
  if (spouses.length === 1 && node.person.gender === "female" && spouses[0]?.gender === "male") {
    return [spouses[0], node.person];
  }
  return [node.person, ...spouses];
}
