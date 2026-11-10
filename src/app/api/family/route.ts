import { query } from "@/lib/db";
import { handle, requireUser } from "@/lib/http";
import { PERSON_COLUMNS } from "@/lib/requests";
import type { FamilyData, Person, Union } from "@/lib/types";

// Seluruh data silsilah yang sudah disetujui. Frontend menyusun pohonnya sendiri.
export const GET = handle(async () => {
  await requireUser();
  const [persons, unions] = await Promise.all([
    query<Person>(`SELECT ${PERSON_COLUMNS} FROM persons ORDER BY birth_date NULLS LAST, id`),
    query<Union>("SELECT id::int, partner_a::int, partner_b::int FROM unions ORDER BY id"),
  ]);
  const data: FamilyData = { persons: persons.rows, unions: unions.rows };
  return Response.json(data);
});
