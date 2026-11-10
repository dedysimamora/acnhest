import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Format tanggal tidak valid");

export const personInput = z
  .object({
    full_name: z.string().trim().min(1, "Nama wajib diisi").max(120, "Nama maksimal 120 karakter"),
    gender: z.enum(["male", "female"], { message: "Jenis kelamin wajib dipilih" }),
    birth_date: optionalDate,
    death_date: optionalDate,
    birth_place: optionalText(120),
    notes: optionalText(1000),
  })
  .refine((p) => !p.birth_date || !p.death_date || p.death_date >= p.birth_date, {
    message: "Tanggal wafat tidak boleh sebelum tanggal lahir",
    path: ["death_date"],
  });

export type PersonInput = z.infer<typeof personInput>;

const id = z.coerce.number().int().positive();

export const requestInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add_root"), payload: z.object({ person: personInput }) }),
  z.object({
    type: z.literal("add_child"),
    payload: z.object({
      parent_id: id,
      // union_id = pasangan mana yang menjadi orang tua; null = orang tua tunggal
      union_id: id.nullable().optional().transform((v) => v ?? null),
      person: personInput,
    }),
  }),
  z.object({
    type: z.literal("add_spouse"),
    payload: z.object({ person_id: id, person: personInput }),
  }),
  z.object({
    type: z.literal("add_parents"),
    payload: z
      .object({
        person_id: id,
        father: personInput.nullable().optional().transform((v) => v ?? null),
        mother: personInput.nullable().optional().transform((v) => v ?? null),
      })
      .refine((p) => p.father || p.mother, { message: "Isi minimal ayah atau ibu" }),
  }),
  z.object({
    type: z.literal("edit_person"),
    payload: z.object({ person_id: id, person: personInput }),
  }),
]);

export type RequestInput = z.infer<typeof requestInput>;
export type RequestType = RequestInput["type"];

export const credentialsInput = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username minimal 3 karakter")
    .max(40, "Username maksimal 40 karakter")
    .regex(/^[a-z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, minus, garis bawah"),
  password: z.string().min(8, "Password minimal 8 karakter").max(200),
});

export const registerInput = credentialsInput.extend({
  name: z.string().trim().min(1, "Nama wajib diisi").max(120),
});
