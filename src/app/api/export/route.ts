import ExcelJS from "exceljs";
import { query } from "@/lib/db";
import { buildFamily } from "@/lib/family";
import { handle, requireUser } from "@/lib/http";
import { PERSON_COLUMNS } from "@/lib/requests";
import type { Person, Union } from "@/lib/types";

// GET /api/export → file .xlsx berisi seluruh orang di silsilah (yang sudah disetujui),
// dengan filter (AutoFilter) di setiap kolom.
export const GET = handle(async () => {
  await requireUser();
  const [persons, unions] = await Promise.all([
    query<Person>(`SELECT ${PERSON_COLUMNS} FROM persons`),
    query<Union>("SELECT id::int, partner_a::int, partner_b::int FROM unions"),
  ]);
  const family = buildFamily({ persons: persons.rows, unions: unions.rows });

  const toDate = (iso: string | null) => {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };
  const name = (id: number | null | undefined) => (id != null ? (family.persons.get(id)?.full_name ?? "") : "");

  const rows = persons.rows.map((p) => {
    const node = family.nodeOfPerson.get(p.id);
    const parentUnion = p.parent_union_id ? family.unions.get(p.parent_union_id) : undefined;
    const parents = parentUnion ? [parentUnion.partner_a, parentUnion.partner_b] : [];
    const father = parents.find((id) => id != null && family.persons.get(id)?.gender === "male");
    const mother = parents.find((id) => id != null && family.persons.get(id)?.gender === "female");
    const myUnions = family.unionsByPerson.get(p.id) ?? [];
    const spouses = myUnions
      .map((u) => (u.partner_a === p.id ? u.partner_b : u.partner_a))
      .filter((id): id is number => id != null)
      .map(name);
    const childCount = myUnions.reduce((n, u) => n + (family.childrenByUnion.get(u.id)?.length ?? 0), 0);

    return {
      id: p.id,
      full_name: p.full_name,
      gender: p.gender === "male" ? "Laki-laki" : "Perempuan",
      birth_date: toDate(p.birth_date),
      birth_year: p.birth_date ? Number(p.birth_date.slice(0, 4)) : null,
      birth_place: p.birth_place ?? "",
      death_date: toDate(p.death_date),
      status: p.death_date ? "Wafat" : "Hidup",
      generation: node ? node.depth + 1 : null,
      line: node?.person.id === p.id ? "Keturunan" : "Pasangan",
      father: name(father),
      mother: name(mother),
      spouses: spouses.join("; "),
      children: childCount,
      notes: p.notes ?? "",
    };
  });

  rows.sort(
    (a, b) =>
      (a.generation ?? 999) - (b.generation ?? 999) ||
      (a.birth_date?.getTime() ?? Infinity) - (b.birth_date?.getTime() ?? Infinity) ||
      a.id - b.id,
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "Silsilah Keluarga";
  wb.created = new Date();
  const ws = wb.addWorksheet("Anggota Keluarga", { views: [{ state: "frozen", ySplit: 1 }] });

  ws.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "ID", key: "id", width: 7 },
    { header: "Nama Lengkap", key: "full_name", width: 30 },
    { header: "Jenis Kelamin", key: "gender", width: 15 },
    { header: "Tanggal Lahir", key: "birth_date", width: 15, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Tahun Lahir", key: "birth_year", width: 12 },
    { header: "Tempat Lahir", key: "birth_place", width: 18 },
    { header: "Tanggal Wafat", key: "death_date", width: 15, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Status", key: "status", width: 10 },
    { header: "Generasi", key: "generation", width: 10 },
    { header: "Garis", key: "line", width: 12 },
    { header: "Ayah", key: "father", width: 26 },
    { header: "Ibu", key: "mother", width: 26 },
    { header: "Pasangan", key: "spouses", width: 30 },
    { header: "Jumlah Anak", key: "children", width: 12 },
    { header: "Catatan", key: "notes", width: 40 },
  ];
  rows.forEach((r, i) => ws.addRow({ no: i + 1, ...r }));

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  ws.getColumn("notes").alignment = { wrapText: true, vertical: "top" };

  // Filter di setiap kolom header.
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: ws.columns.length } };

  const buffer = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="silsilah-keluarga-${stamp}.xlsx"`,
      "cache-control": "no-store",
    },
  });
});
