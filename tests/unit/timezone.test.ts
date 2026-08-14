import { describe, expect, it } from 'vitest';
import {
  addSingaporeDays,
  addSingaporeMinutes,
  daysInMonth,
  formatSingaporeDate,
  fromSingaporeParts,
  parseSingaporeDate,
  toSingaporeDateString,
  toSingaporeParts,
  tryParseSingaporeDate,
} from '@/lib/timezone';

describe('parseSingaporeDate', () => {
  it('interprets a bare timestamp as Singapore wall-clock time', () => {
    // 2026-03-01 00:30 SGT is 2026-02-28 16:30 UTC.
    expect(parseSingaporeDate('2026-03-01T00:30:00').toISOString()).toBe(
      '2026-02-28T16:30:00.000Z',
    );
  });

  it('respects an explicit UTC marker rather than re-interpreting it', () => {
    expect(parseSingaporeDate('2026-03-01T00:30:00Z').toISOString()).toBe(
      '2026-03-01T00:30:00.000Z',
    );
  });

  it('expands a date-only value to midnight Singapore time', () => {
    expect(parseSingaporeDate('2026-03-01').toISOString()).toBe('2026-02-28T16:00:00.000Z');
  });

  it('rejects unparseable values', () => {
    expect(() => parseSingaporeDate('not-a-date')).toThrow();
    expect(tryParseSingaporeDate('not-a-date')).toBeNull();
    expect(tryParseSingaporeDate(null)).toBeNull();
  });
});

describe('formatSingaporeDate', () => {
  it('reports the Singapore calendar date across the UTC day boundary', () => {
    // 2026-02-28 16:30 UTC is already 1 March in Singapore.
    const instant = new Date('2026-02-28T16:30:00.000Z');
    expect(formatSingaporeDate(instant, 'yyyy-MM-dd')).toBe('2026-03-01');
    expect(toSingaporeDateString(instant)).toBe('2026-03-01');
  });

  it('accepts either casing of the date pattern', () => {
    const instant = new Date('2026-03-01T02:00:00.000Z');
    expect(formatSingaporeDate(instant, 'YYYY-MM-DD')).toBe(
      formatSingaporeDate(instant, 'yyyy-MM-dd'),
    );
  });

  it('renders midnight as 00, not 24', () => {
    expect(formatSingaporeDate('2026-03-01T00:00:00', 'HH:mm')).toBe('00:00');
  });
});

describe('calendar part helpers', () => {
  it('round-trips parts through fromSingaporeParts', () => {
    const parts = toSingaporeParts('2026-07-04T09:15:30');
    expect(parts).toEqual({ year: 2026, month: 7, day: 4, hour: 9, minute: 15, second: 30 });
    expect(fromSingaporeParts(parts, parts.hour, parts.minute, parts.second)).toBe(
      '2026-07-04T09:15:30',
    );
  });

  it('rolls over month and year when adding days', () => {
    expect(addSingaporeDays({ year: 2025, month: 12, day: 28 }, 7)).toEqual({
      year: 2026,
      month: 1,
      day: 4,
    });
  });

  it('knows leap-year February length', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2026, 1)).toBe(31);
  });

  it('adds minutes and returns a canonical stored timestamp', () => {
    expect(addSingaporeMinutes('2026-03-01T23:30:00', 45)).toBe('2026-03-02T00:15:00');
  });
});
