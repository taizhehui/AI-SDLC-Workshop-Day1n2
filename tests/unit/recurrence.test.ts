import { describe, expect, it } from 'vitest';
import { calculateNextDueDate, isRecurrencePattern } from '@/lib/recurrence';

describe('calculateNextDueDate', () => {
  it('advances daily by one day', () => {
    expect(calculateNextDueDate('2025-11-10T14:00:00', 'daily')).toBe('2025-11-11T14:00:00');
  });

  it('advances weekly by seven days', () => {
    expect(calculateNextDueDate('2025-11-10T14:00:00', 'weekly')).toBe('2025-11-17T14:00:00');
  });

  it('advances monthly with no overflow', () => {
    expect(calculateNextDueDate('2025-06-15T09:00:00', 'monthly')).toBe('2025-07-15T09:00:00');
  });

  it('clamps monthly overflow to the last day of a short month', () => {
    // Jan 31 must land on Feb 28, not roll over into March.
    expect(calculateNextDueDate('2025-01-31T09:00:00', 'monthly')).toBe('2025-02-28T09:00:00');
  });

  it('clamps monthly overflow to Feb 29 in a leap year', () => {
    expect(calculateNextDueDate('2024-01-31T09:00:00', 'monthly')).toBe('2024-02-29T09:00:00');
  });

  it('rolls the year over from December to January', () => {
    expect(calculateNextDueDate('2025-12-31T09:00:00', 'monthly')).toBe('2026-01-31T09:00:00');
  });

  it('advances yearly with no overflow', () => {
    expect(calculateNextDueDate('2025-06-15T09:00:00', 'yearly')).toBe('2026-06-15T09:00:00');
  });

  it('clamps a leap day to Feb 28 in a non-leap target year', () => {
    expect(calculateNextDueDate('2024-02-29T09:00:00', 'yearly')).toBe('2025-02-28T09:00:00');
  });

  it('preserves time-of-day across every pattern', () => {
    const patterns = ['daily', 'weekly', 'monthly', 'yearly'] as const;
    for (const pattern of patterns) {
      expect(calculateNextDueDate('2025-03-15T23:47:00', pattern)).toContain('T23:47:00');
    }
  });
});

describe('isRecurrencePattern', () => {
  it('accepts the four supported cadences', () => {
    expect(isRecurrencePattern('daily')).toBe(true);
    expect(isRecurrencePattern('weekly')).toBe(true);
    expect(isRecurrencePattern('monthly')).toBe(true);
    expect(isRecurrencePattern('yearly')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isRecurrencePattern('fortnightly')).toBe(false);
    expect(isRecurrencePattern('Daily')).toBe(false);
    expect(isRecurrencePattern(null)).toBe(false);
  });
});
