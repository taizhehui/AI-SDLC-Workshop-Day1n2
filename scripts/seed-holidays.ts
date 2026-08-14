/**
 * Seed Singapore public holidays into the `holidays` table.
 *
 * Usage: `npm run seed:holidays` (or `npx tsx scripts/seed-holidays.ts`).
 *
 * Idempotent — re-running updates existing names in place rather than creating duplicates,
 * so it is safe to run after every deploy.
 */
import { closeDb, holidayDB } from '../lib/db';
import { SINGAPORE_HOLIDAYS } from './singapore-holidays';

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
