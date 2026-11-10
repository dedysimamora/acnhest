// Tipe data yang dikirim BFF ke frontend.

export type Gender = "male" | "female";

export type Person = {
  id: number;
  full_name: string;
  gender: Gender;
  birth_date: string | null;
  death_date: string | null;
  birth_place: string | null;
  notes: string | null;
  parent_union_id: number | null;
};

export type Union = {
  id: number;
  partner_a: number;
  partner_b: number | null;
};

export type FamilyData = { persons: Person[]; unions: Union[] };

export type Me = { id: number; username: string; name: string; role: "admin" | "user" };

export type RequestStatus = "pending" | "approved" | "rejected";

export type ChangeRequest = {
  id: number;
  type: "add_root" | "add_child" | "add_spouse" | "add_parents" | "edit_person";
  payload: Record<string, unknown>;
  status: RequestStatus;
  requested_by: { id: number; name: string; username: string };
  reviewed_by: { id: number; name: string } | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  /** Ringkasan yang mudah dibaca, dibuat di server. */
  summary: string;
  /** Data orang yang dirujuk (orang tua / pasangan / yang diedit) saat ini. */
  target: Person | null;
};
