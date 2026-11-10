// Menjalankan skema database dan membuat/memperbarui akun admin awal.
// Pemakaian: npm run db:setup
import { readFile } from "node:fs/promises";
import pg from "pg";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL belum di-set (lihat .env.example).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  await client.query(schema);
  console.log("✓ Skema database siap");

  const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "admin12345";
  const name = process.env.ADMIN_NAME || "Administrator";
  const existing = await client.query("SELECT id FROM users WHERE username = $1", [username]);
  if (existing.rowCount === 0) {
    const hash = await bcrypt.hash(password, 10);
    await client.query(
      "INSERT INTO users (username, name, password_hash, role) VALUES ($1, $2, $3, 'admin')",
      [username, name, hash],
    );
    console.log(`✓ Admin dibuat: ${username}`);
  } else {
    await client.query("UPDATE users SET role = 'admin' WHERE username = $1", [username]);
    console.log(`✓ Admin sudah ada: ${username}`);
  }
} finally {
  await client.end();
}
