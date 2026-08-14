/**
 * Singapore-timezone (Asia/Singapore) date utilities.
 *
 * Every date/time operation in the app funnels through this module — see CLAUDE.md
 * ("Singapore Timezone (Mandatory)"). Never call `new Date()` outside of `getSingaporeNow()`.
 *
 * Storage contract
 * ----------------
 * All persisted timestamps (`due_date`, `created_at`, `updated_at`,
 * `last_notification_sent`) use Singapore *wall-clock* time in the format
 * `YYYY-MM-DDTHH:mm:ss` — no trailing `Z`, no offset suffix. This keeps three things true
 * simultaneously:
 *
 *   1. `value.slice(0, 10)` is the Singapore calendar date (used by filters + calendar cells).
 *   2. SQLite's `datetime(due_date, '-N minutes')` arithmetic works directly on the column.
 *   3. Sorting the column lexicographically equals sorting it chronologically.
 *
 * Because the strings carry no zone, they must never be handed to `new Date(...)` directly.
 * Use `parseSingaporeDate()`, which attaches the `+08:00` offset before parsing so the
 * resulting instant is correct regardless of the host machine's local timezone.
 */

export const SINGAPORE_TIMEZONE = 'Asia/Singapore';

/** Singapore has observed a fixed UTC+08:00 offset with no DST since 1982. */
export const SINGAPORE_UTC_OFFSET = '+08:00';

export interface SingaporeDateParts {
  year: number;
  /** 1-12 (calendar month, not the 0-indexed JS convention). */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface SingaporeYearMonthDay {
  year: number;
  month: number;
  day: number;
}

export type DateInput = Date | string | number;

/** Matches an ISO-ish string that already specifies a timezone (`Z` or `±HH:mm`). */
const HAS_TIMEZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/** Matches a bare Singapore-local timestamp: `YYYY-MM-DD` optionally followed by a time. */
const BARE_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SINGAPORE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/**
 * The current instant. Formatting/derivation of Singapore calendar values is done by the
 * other helpers here, all of which resolve through `Asia/Singapore`.
 */
export function getSingaporeNow(): Date {
  return new Date();
}

/**
 * Parse any stored or incoming timestamp into a real instant.
 *
 * Bare `YYYY-MM-DDTHH:mm:ss` strings are interpreted as Singapore wall-clock time; strings
 * that already carry `Z` or an offset are respected as-is.
 *
 * @throws {Error} when the value cannot be parsed into a valid date.
 */
export function parseSingaporeDate(value: DateInput): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('Invalid date value');
    }
    return value;
  }

  if (typeof value === 'number') {
    const fromEpoch = new Date(value);
    if (Number.isNaN(fromEpoch.getTime())) {
      throw new Error(`Invalid date value: ${value}`);
    }
    return fromEpoch;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Invalid date value: empty string');
  }

  const normalized = HAS_TIMEZONE.test(trimmed)
    ? trimmed
    : `${normalizeBareTimestamp(trimmed)}${SINGAPORE_UTC_OFFSET}`;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return parsed;
}

/** Like `parseSingaporeDate` but returns `null` instead of throwing. */
export function tryParseSingaporeDate(value: DateInput | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  try {
    return parseSingaporeDate(value);
  } catch {
    return null;
  }
}

/** True when the value parses into a real instant. */
export function isValidSingaporeDate(value: DateInput | null | undefined): boolean {
  return tryParseSingaporeDate(value) !== null;
}

/** Expand `YYYY-MM-DD` / `YYYY-MM-DD HH:mm` into the canonical `YYYY-MM-DDTHH:mm:ss` shape. */
function normalizeBareTimestamp(value: string): string {
  const match = BARE_TIMESTAMP.exec(value);
  if (!match) return value;
  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

/** Break an instant into its Singapore calendar/clock components. */
export function toSingaporeParts(value: DateInput): SingaporeDateParts {
  const date = parseSingaporeDate(value);
  const lookup: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== 'literal') lookup[part.type] = part.value;
  }

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    // Intl renders midnight as "24" in some ICU versions under hour12: false.
    hour: Number(lookup.hour) % 24,
    minute: Number(lookup.minute),
    second: Number(lookup.second),
  };
}

/**
 * Build the canonical stored representation from explicit Singapore calendar parts.
 * Used by recurrence math, which must clamp day-of-month rather than let dates roll over.
 */
export function fromSingaporeParts(
  { year, month, day }: SingaporeYearMonthDay,
  hour = 0,
  minute = 0,
  second = 0,
): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

export type SingaporeDatePattern =
  | 'yyyy-MM-dd'
  | 'yyyy-MM-ddTHH:mm'
  | 'yyyy-MM-ddTHH:mm:ss'
  | 'yyyy-MM-dd HH:mm'
  | 'yyyy-MM-dd HH:mm:ss'
  | 'yyyy-MM'
  | 'HH:mm';

/**
 * Format an instant using Singapore calendar values.
 *
 * Patterns are case-insensitive on the date portion so both `yyyy-MM-dd` (used by the API
 * layer) and `YYYY-MM-DD` (used by the calendar PRP) resolve to the same output.
 */
export function formatSingaporeDate(
  value: DateInput,
  pattern: SingaporeDatePattern | string = 'yyyy-MM-ddTHH:mm:ss',
): string {
  const { year, month, day, hour, minute, second } = toSingaporeParts(value);

  switch (pattern.toLowerCase()) {
    case 'yyyy-mm-dd':
      return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
    case 'yyyy-mm':
      return `${pad(year, 4)}-${pad(month)}`;
    case 'hh:mm':
      return `${pad(hour)}:${pad(minute)}`;
    case 'yyyy-mm-ddthh:mm':
      return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
    case 'yyyy-mm-dd hh:mm':
      return `${pad(year, 4)}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`;
    case 'yyyy-mm-dd hh:mm:ss':
      return `${pad(year, 4)}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
    case 'yyyy-mm-ddthh:mm:ss':
    default:
      return fromSingaporeParts({ year, month, day }, hour, minute, second);
  }
}

/** Canonical stored timestamp (`YYYY-MM-DDTHH:mm:ss`, Singapore wall clock). */
export function toSingaporeTimestamp(value: DateInput = getSingaporeNow()): string {
  return formatSingaporeDate(value, 'yyyy-MM-ddTHH:mm:ss');
}

/** Singapore calendar date (`YYYY-MM-DD`) for the given instant. */
export function toSingaporeDateString(value: DateInput = getSingaporeNow()): string {
  return formatSingaporeDate(value, 'yyyy-MM-dd');
}

/** The value the `<input type="datetime-local">` control expects. */
export function toDateTimeLocalValue(value: DateInput): string {
  return formatSingaporeDate(value, 'yyyy-MM-ddTHH:mm');
}

/** Shift an instant by whole minutes, returning a canonical stored timestamp. */
export function addSingaporeMinutes(value: DateInput, minutes: number): string {
  const base = parseSingaporeDate(value);
  return toSingaporeTimestamp(new Date(base.getTime() + minutes * 60_000));
}

/** Shift Singapore calendar parts by whole days, normalizing month/year rollover. */
export function addSingaporeDays(
  { year, month, day }: SingaporeYearMonthDay,
  days: number,
): SingaporeYearMonthDay {
  // UTC arithmetic on a zone-free calendar triple: safe because no DST is involved and the
  // parts are re-extracted in the same (UTC) frame they were built in.
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Number of days in a Singapore calendar month. `month` is 1-12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Milliseconds between two timestamps (`b - a`). */
export function diffMilliseconds(a: DateInput, b: DateInput): number {
  return parseSingaporeDate(b).getTime() - parseSingaporeDate(a).getTime();
}

/** True when the timestamp is strictly before `reference` (defaults to now). */
export function isBeforeSingapore(
  value: DateInput,
  reference: DateInput = getSingaporeNow(),
): boolean {
  return parseSingaporeDate(value).getTime() < parseSingaporeDate(reference).getTime();
}

const DISPLAY_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const DISPLAY_FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Human-readable due date, e.g. `12 Mar 2026, 14:30`. */
export function formatDueDate(value: DateInput): string {
  const { year, month, day, hour, minute } = toSingaporeParts(value);
  return `${day} ${DISPLAY_MONTHS[month - 1]} ${year}, ${pad(hour)}:${pad(minute)}`;
}

/** Human-readable month heading, e.g. `March 2026`. */
export function formatMonthLabel(year: number, month: number): string {
  return `${DISPLAY_FULL_MONTHS[month - 1]} ${year}`;
}

/** Human-readable day heading, e.g. `Thursday, 12 March 2026`. */
export function formatDayLabel(dateStr: string): string {
  const { year, month, day } = toSingaporeParts(dateStr);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const weekdays = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return `${weekdays[weekday]}, ${day} ${DISPLAY_FULL_MONTHS[month - 1]} ${year}`;
}
