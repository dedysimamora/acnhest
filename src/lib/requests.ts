import "server-only";
import type { PoolClient } from "pg";
import { HttpError } from "./http";
import { pool, query, withTransaction } from "./db";
import type { PersonInput, RequestInput } from "./schemas";
import type { SessionUser } from "./auth";
import type { ChangeRequest, Person } from "./types";

type Db = Pick<PoolClient, "query">;

export const PERSON_COLUMNS =
  "id::int, full_name, gender, to_char(birth_date, 'YYYY-MM-DD') AS birth_date, " +
  "to_char(death_date, 'YYYY-MM-DD') AS death_date, birth_place, notes, parent_union_id::int";

async function getPerson(db: Db, id: number): Promise<Person | null> {
  const { rows } = await db.query<Person>(`SELECT ${PERSON_COLUMNS} FROM persons WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

async function mustGetPerson(db: Db, id: number, label = "Orang"): Promise<Person> {
  const p = await getPerson(db, id);
  if (!p) throw new HttpError(409, `${label} yang dirujuk tidak ditemukan (mungkin sudah dihapus)`);
  return p;
}

async function insertPerson(db: Db, p: PersonInput, parentUnionId: number | null, userId: number) {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO persons (full_name, gender, birth_date, death_date, birth_place, notes, parent_union_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id::int`,
    [p.full_name, p.gender, p.birth_date, p.death_date, p.birth_place, p.notes, parentUnionId, userId],
  );
  return rows[0].id;
}

async function insertUnion(db: Db, a: Person | { id: number; gender: string }, b: { id: number; gender: string } | null) {
  // Simpan laki-laki sebagai partner_a agar urutan di kotak konsisten (suami lalu istri).
  let [first, second] = [a, b];
  if (second && first.gender === "female" && second.gender === "male") [first, second] = [second, first];
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO unions (partner_a, partner_b) VALUES ($1, $2) RETURNING id::int",
    [first.id, second?.id ?? null],
  );
  return rows[0].id;
}

/** Memeriksa bahwa permintaan masuk akal terhadap data saat ini. Dipakai saat submit dan saat approve. */
async function validateAgainstData(db: Db, input: RequestInput) {
  switch (input.type) {
    case "add_root":
      return;
    case "add_child": {
      await mustGetPerson(db, input.payload.parent_id, "Orang tua");
      if (input.payload.union_id) {
        const { rows } = await db.query(
          "SELECT 1 FROM unions WHERE id = $1 AND (partner_a = $2 OR partner_b = $2)",
          [input.payload.union_id, input.payload.parent_id],
        );
        if (!rows[0]) throw new HttpError(409, "Pasangan orang tua tidak cocok");
      }
      return;
    }
    case "add_spouse":
    case "edit_person":
      await mustGetPerson(db, input.payload.person_id);
      return;
    case "add_parents": {
      const p = await mustGetPerson(db, input.payload.person_id);
      if (p.parent_union_id) throw new HttpError(409, `${p.full_name} sudah memiliki data orang tua`);
      return;
    }
  }
}

async function apply(db: Db, input: RequestInput, requestedBy: number) {
  await validateAgainstData(db, input);
  switch (input.type) {
    case "add_root":
      await insertPerson(db, input.payload.person, null, requestedBy);
      return;
    case "add_child": {
      const { parent_id, person } = input.payload;
      let unionId = input.payload.union_id;
      if (!unionId) {
        // Orang tua tunggal: pakai union tanpa pasangan milik orang tersebut, atau buat baru.
        const { rows } = await db.query<{ id: number }>(
          "SELECT id::int FROM unions WHERE partner_a = $1 AND partner_b IS NULL LIMIT 1",
          [parent_id],
        );
        unionId = rows[0]?.id ?? (await insertUnion(db, { id: parent_id, gender: "male" }, null));
      }
      await insertPerson(db, person, unionId, requestedBy);
      return;
    }
    case "add_spouse": {
      const target = await mustGetPerson(db, input.payload.person_id);
      const spouseId = await insertPerson(db, input.payload.person, null, requestedBy);
      // Jika target punya union "orang tua tunggal", isi pasangannya ke union itu
      // supaya anak yang sudah ada otomatis menjadi anak pasangan ini.
      const { rows } = await db.query<{ id: number }>(
        "SELECT id::int FROM unions WHERE partner_a = $1 AND partner_b IS NULL LIMIT 1",
        [target.id],
      );
      if (rows[0]) {
        const swap = target.gender === "female" && input.payload.person.gender === "male";
        await db.query(
          swap
            ? "UPDATE unions SET partner_a = $2, partner_b = $3 WHERE id = $1"
            : "UPDATE unions SET partner_b = $2 WHERE id = $1",
          swap ? [rows[0].id, spouseId, target.id] : [rows[0].id, spouseId],
        );
      } else {
        await insertUnion(db, target, { id: spouseId, gender: input.payload.person.gender });
      }
      return;
    }
    case "add_parents": {
      const { person_id, father, mother } = input.payload;
      const fatherId = father ? await insertPerson(db, father, null, requestedBy) : null;
      const motherId = mother ? await insertPerson(db, mother, null, requestedBy) : null;
      const a = fatherId ?? motherId!;
      const { rows } = await db.query<{ id: number }>(
        "INSERT INTO unions (partner_a, partner_b) VALUES ($1, $2) RETURNING id::int",
        [a, fatherId && motherId ? motherId : null],
      );
      await db.query("UPDATE persons SET parent_union_id = $1, updated_at = now() WHERE id = $2", [
        rows[0].id,
        person_id,
      ]);
      return;
    }
    case "edit_person": {
      const p = input.payload.person;
      await db.query(
        `UPDATE persons SET full_name = $2, gender = $3, birth_date = $4, death_date = $5,
                birth_place = $6, notes = $7, updated_at = now() WHERE id = $1`,
        [input.payload.person_id, p.full_name, p.gender, p.birth_date, p.death_date, p.birth_place, p.notes],
      );
      return;
    }
  }
}

/** User biasa: masuk antrean pending. Admin: langsung diterapkan (tetap tercatat). */
export async function submitRequest(user: SessionUser, input: RequestInput) {
  if (user.role === "admin") {
    return withTransaction(async (db) => {
      await apply(db, input, user.id);
      const { rows } = await db.query<{ id: number }>(
        `INSERT INTO change_requests (type, payload, status, requested_by, reviewed_by, reviewed_at)
         VALUES ($1, $2, 'approved', $3, $3, now()) RETURNING id::int`,
        [input.type, input.payload, user.id],
      );
      return { id: rows[0].id, status: "approved" as const };
    });
  }
  await validateAgainstData(pool, input);
  const { rows } = await query<{ id: number }>(
    "INSERT INTO change_requests (type, payload, requested_by) VALUES ($1, $2, $3) RETURNING id::int",
    [input.type, input.payload, user.id],
  );
  return { id: rows[0].id, status: "pending" as const };
}

export async function reviewRequest(admin: SessionUser, id: number, decision: "approve" | "reject", note: string | null) {
  return withTransaction(async (db) => {
    const { rows } = await db.query<{ type: RequestInput["type"]; payload: unknown; status: string; requested_by: number }>(
      "SELECT type, payload, status, requested_by::int FROM change_requests WHERE id = $1 FOR UPDATE",
      [id],
    );
    const req = rows[0];
    if (!req) throw new HttpError(404, "Permintaan tidak ditemukan");
    if (req.status !== "pending") throw new HttpError(409, "Permintaan ini sudah diproses");
    if (decision === "approve") {
      await apply(db, { type: req.type, payload: req.payload } as RequestInput, req.requested_by);
    }
    await db.query(
      `UPDATE change_requests SET status = $2, reviewed_by = $3, review_note = $4, reviewed_at = now() WHERE id = $1`,
      [id, decision === "approve" ? "approved" : "rejected", admin.id, note],
    );
  });
}

type Row = {
  id: number;
  type: ChangeRequest["type"];
  payload: Record<string, unknown>;
  status: ChangeRequest["status"];
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  req_id: number;
  req_name: string;
  req_username: string;
  rev_id: number | null;
  rev_name: string | null;
};

export async function listRequests(filter: { status?: string; requestedBy?: number; limit?: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    params.push(filter.status);
    where.push(`cr.status = $${params.length}`);
  }
  if (filter.requestedBy) {
    params.push(filter.requestedBy);
    where.push(`cr.requested_by = $${params.length}`);
  }
  params.push(filter.limit ?? 100);
  const { rows } = await query<Row>(
    `SELECT cr.id::int, cr.type, cr.payload, cr.status, cr.review_note, cr.created_at, cr.reviewed_at,
            ru.id::int AS req_id, ru.name AS req_name, ru.username AS req_username,
            rv.id::int AS rev_id, rv.name AS rev_name
       FROM change_requests cr
       JOIN users ru ON ru.id = cr.requested_by
       LEFT JOIN users rv ON rv.id = cr.reviewed_by
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY (cr.status = 'pending') DESC, cr.created_at DESC
      LIMIT $${params.length}`,
    params,
  );

  // Ambil data orang yang dirujuk sekaligus.
  const refIds = new Set<number>();
  for (const r of rows) {
    const ref = Number(r.payload.parent_id ?? r.payload.person_id);
    if (ref) refIds.add(ref);
  }
  const refs = new Map<number, Person>();
  if (refIds.size) {
    const res = await query<Person>(`SELECT ${PERSON_COLUMNS} FROM persons WHERE id = ANY($1::bigint[])`, [[...refIds]]);
    for (const p of res.rows) refs.set(p.id, p);
  }

  return rows.map<ChangeRequest>((r) => {
    const target = refs.get(Number(r.payload.parent_id ?? r.payload.person_id)) ?? null;
    return {
      id: r.id,
      type: r.type,
      payload: r.payload,
      status: r.status,
      requested_by: { id: r.req_id, name: r.req_name, username: r.req_username },
      reviewed_by: r.rev_id ? { id: r.rev_id, name: r.rev_name! } : null,
      review_note: r.review_note,
      created_at: new Date(r.created_at).toISOString(),
      reviewed_at: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
      summary: summarize(r.type, r.payload, target),
      target,
    };
  });
}

function summarize(type: ChangeRequest["type"], payload: Record<string, unknown>, target: Person | null) {
  const name = (p: unknown) => (p as { full_name?: string } | null)?.full_name ?? "?";
  const t = target?.full_name ?? "(data sudah dihapus)";
  switch (type) {
    case "add_root":
      return `Tambah leluhur: ${name(payload.person)}`;
    case "add_child":
      return `Tambah anak ${name(payload.person)} untuk ${t}`;
    case "add_spouse":
      return `Tambah pasangan ${name(payload.person)} untuk ${t}`;
    case "add_parents": {
      const ps = [payload.father, payload.mother].filter(Boolean).map(name).join(" & ");
      return `Tambah orang tua ${ps} untuk ${t}`;
    }
    case "edit_person":
      return `Ubah data ${t}`;
  }
}
