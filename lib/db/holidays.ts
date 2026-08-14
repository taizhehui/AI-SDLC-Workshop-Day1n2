import { getDb } from './client';
import { toSingaporeTimestamp } from '../timezone';
import type { Holiday } from './types';

/**
 * Read/seed access for the `holidays` table (PRP 10).
 *
 * Holidays are global (Singapore public holidays apply to every user), so unlike every other
 * table here there is no `user_id` scoping.
 */
export const holidayDB = {
  findAll(): Holiday[] {
    return getDb()
      .prepare(`SELECT id, date, name, created_at FROM holidays ORDER BY date ASC`)
      .all() as Holiday[];
  },

  /**
   * Holidays within the given month, padded by `paddingDays` on each side so the leading and
   * trailing cells the calendar grid borrows from adjacent months are covered too.
   */
  findByMonth(year: number, month: number, paddingDays = 7): Holiday[] {
    const start = new Date(Date.UTC(year, month - 1, 1 - paddingDays));
    const end = new Date(Date.UTC(year, month, paddingDays));

    return getDb()
      .prepare(
        `SELECT id, date, name, created_at FROM holidays
          WHERE date >= ? AND date <= ?
          ORDER BY date ASC`,
      )
      .all(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)) as Holiday[];
  },

  findByDate(date: string): Holiday | null {
    const row = getDb()
      .prepare(`SELECT id, date, name, created_at FROM holidays WHERE date = ?`)
      .get(date) as Holiday | undefined;
    return row ?? null;
  },

  /** Idempotent seed — re-running updates names in place rather than duplicating rows. */
  upsertMany(holidays: Array<{ date: string; name: string }>): number {
    const db = getDb();
    const statement = db.prepare(
      `INSERT INTO holidays (date, name, created_at) VALUES (?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET name = excluded.name`,
    );

    const run = db.transaction((batch: Array<{ date: string; name: string }>) => {
      const now = toSingaporeTimestamp();
      for (const holiday of batch) {
        statement.run(holiday.date, holiday.name, now);
      }
    });

    run(holidays);
    return holidays.length;
  },
};
