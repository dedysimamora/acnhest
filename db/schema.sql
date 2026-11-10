-- Skema aplikasi silsilah keluarga.
-- Aman dijalankan berulang (idempotent).

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- Pasangan / keluarga. Anak menunjuk ke union orang tuanya.
-- partner_b boleh NULL (orang tua tunggal / pasangan tidak diketahui).
CREATE TABLE IF NOT EXISTS unions (
  id         BIGSERIAL PRIMARY KEY,
  partner_a  BIGINT NOT NULL,
  partner_b  BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hanya data yang SUDAH disetujui admin yang ada di tabel ini.
CREATE TABLE IF NOT EXISTS persons (
  id              BIGSERIAL PRIMARY KEY,
  full_name       TEXT NOT NULL,
  gender          TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  birth_date      DATE,
  death_date      DATE,
  birth_place     TEXT,
  notes           TEXT,
  parent_union_id BIGINT REFERENCES unions(id) ON DELETE SET NULL,
  created_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS persons_parent_union_idx ON persons(parent_union_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unions_partner_a_fk') THEN
    ALTER TABLE unions ADD CONSTRAINT unions_partner_a_fk
      FOREIGN KEY (partner_a) REFERENCES persons(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unions_partner_b_fk') THEN
    ALTER TABLE unions ADD CONSTRAINT unions_partner_b_fk
      FOREIGN KEY (partner_b) REFERENCES persons(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS unions_partner_a_idx ON unions(partner_a);
CREATE INDEX IF NOT EXISTS unions_partner_b_idx ON unions(partner_b);

-- Setiap penambahan/perubahan data dari user masuk sebagai permintaan.
-- Data baru masuk ke tabel persons/unions setelah permintaan disetujui admin.
CREATE TABLE IF NOT EXISTS change_requests (
  id           BIGSERIAL PRIMARY KEY,
  type         TEXT NOT NULL CHECK (type IN ('add_root', 'add_child', 'add_spouse', 'add_parents', 'edit_person')),
  payload      JSONB NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewed_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  review_note  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS change_requests_status_idx ON change_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS change_requests_requested_by_idx ON change_requests(requested_by, created_at DESC);
