/**
 * Refresh Singapore public holidays in the `holidays` table.
 *
 * Usage: `npm run seed:holidays` (or `npx tsx scripts/seed-holidays.ts`).
 *
 * A fresh database seeds itself on first connection (see `lib/db/client.ts`), so this script
 * is for *updating* an existing database — after adding a new year to
 * `lib/singapore-holidays.ts`, or correcting a date. Idempotent: re-running updates names in
 * place rather than creating duplicates.
 */
import { closeDb, holidayDB } from '../lib/db';
import { SINGAPORE_HOLIDAYS } from '../lib/singapore-holidays';

function main(): void {
  const before = holidayDB.findAll().length;
  const seeded = holidayDB.upsertMany(SINGAPORE_HOLIDAYS);
  const after = holidayDB.findAll().length;

  console.warn(
    `Seeded ${seeded} Singapore holidays (${after - before} new, ${seeded - (after - before)} updated).`,
  );
  closeDb();
}

main();
