// Mengisi contoh silsilah 5 generasi untuk mencoba tampilan pohon.
// Pemakaian: npm run db:seed-demo   (hanya berjalan jika tabel persons kosong)
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const first = { male: ["Ahmad", "Budi", "Dedi", "Eko", "Fajar", "Hadi", "Irfan", "Joko", "Rudi", "Yusuf", "Rizki", "Bayu", "Agus", "Dimas", "Arif"],
  female: ["Siti", "Aisyah", "Dewi", "Fitri", "Rina", "Lestari", "Wulan", "Nur", "Ratna", "Indah", "Putri", "Sari", "Ayu", "Maya", "Intan"] };
const last = ["Santoso", "Wijaya", "Hidayat", "Pratama", "Saputra", "Kusuma", "Nugroho", "Rahman", "Setiawan", "Hakim"];
let seed = 7;
const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

async function person(name, gender, birthYear, parentUnionId = null) {
  const r = await client.query(
    `INSERT INTO persons (full_name, gender, birth_date, birth_place, parent_union_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [name, gender, `${birthYear}-0${1 + Math.floor(rand() * 9)}-1${Math.floor(rand() * 9)}`,
     pick(["Bandung", "Jakarta", "Yogyakarta", "Surabaya", "Medan", "Garut"]), parentUnionId],
  );
  return r.rows[0].id;
}
async function union(a, b) {
  const r = await client.query("INSERT INTO unions (partner_a, partner_b) VALUES ($1, $2) RETURNING id", [a, b]);
  return r.rows[0].id;
}

async function grow(personId, gender, surname, birthYear, depth) {
  if (depth === 0) return;
  if (rand() < 0.15 && depth < 4) return; // sebagian tidak menikah
  const spouseGender = gender === "male" ? "female" : "male";
  const spouse = await person(`${pick(first[spouseGender])} ${pick(last)}`, spouseGender, birthYear + 2);
  const u = gender === "male" ? await union(personId, spouse) : await union(spouse, personId);
  const kids = depth >= 3 ? 2 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 3);
  for (let i = 0; i < kids; i++) {
    const g = rand() < 0.5 ? "male" : "female";
    const childSurname = gender === "male" ? surname : pick(last);
    const by = birthYear + 24 + i * 2;
    const child = await person(`${pick(first[g])} ${childSurname}`, g, by, u);
    await grow(child, g, childSurname, by, depth - 1);
  }
}

try {
  const { rows } = await client.query("SELECT count(*)::int AS n FROM persons");
  if (rows[0].n > 0) {
    console.log("Tabel persons sudah berisi data, seed dilewati.");
  } else {
    await client.query("BEGIN");
    const root = await person("H. Abdullah Santoso", "male", 1920);
    await grow(root, "male", "Santoso", 1920, 4);
    await client.query("COMMIT");
    const c = await client.query("SELECT count(*)::int AS n FROM persons");
    console.log(`✓ Contoh silsilah dibuat: ${c.rows[0].n} orang`);
  }
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  await client.end();
}
