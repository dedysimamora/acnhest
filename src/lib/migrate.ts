import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { pool } from "./db";

const LOCK_ID = 727_001; // advisory lock agar migrasi aman walau ada beberapa instance

/**
 * Dijalankan sekali saat server start (lihat src/instrumentation.ts):
 * membuat/memperbarui tabel dan memastikan akun admin awal ada.
 */
export async function runMigrations() {
  const schema = await readFile(path.join(/* turbopackIgnore: true */ process.cwd(), "db", "schema.sql"), "utf8");

  const client = await connectWithRetry();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    await client.query(schema);

    const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const existing = await client.query("SELECT id FROM users WHERE username = $1", [username]);
    if (existing.rowCount === 0) {
      if (!password) {
        console.warn(`[migrate] ADMIN_PASSWORD belum di-set, akun admin "${username}" tidak dibuat.`);
      } else {
        await client.query("INSERT INTO users (username, name, password_hash, role) VALUES ($1, $2, $3, 'admin')", [
          username,
          process.env.ADMIN_NAME || "Administrator",
          await bcrypt.hash(password, 10),
        ]);
        console.log(`[migrate] Akun admin "${username}" dibuat.`);
      }
    }
    console.log("[migrate] Database siap.");
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    client.release();
  }
}

async function connectWithRetry(attempts = 15) {
  for (let i = 1; ; i++) {
    try {
      return await pool.connect();
    } catch (err) {
      if (i >= attempts) throw err;
      console.log(`[migrate] Menunggu database… (${i}/${attempts})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

export async function migrateOnStartup() {
  try {
    await runMigrations();
  } catch (err) {
    console.error("[migrate] Gagal menyiapkan database:", err);
    // Di production hentikan proses supaya container di-restart dan kesalahan terlihat jelas.
    if (process.env.NODE_ENV === "production") process.exit(1);
  }
}
