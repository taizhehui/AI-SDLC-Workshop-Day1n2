import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, escapeCsvValue, todosToCsv } from '@/lib/csv';
import { makeTodo } from './factories';

describe('escapeCsvValue', () => {
  it('leaves plain values unquoted', () => {
    expect(escapeCsvValue('Buy milk')).toBe('Buy milk');
  });

  it('quotes values containing a comma', () => {
    expect(escapeCsvValue('Buy milk, eggs')).toBe('"Buy milk, eggs"');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(escapeCsvValue('Buy "bread"')).toBe('"Buy ""bread"""');
  });

  it('quotes values containing newlines', () => {
    expect(escapeCsvValue('line one\nline two')).toBe('"line one\nline two"');
  });

  it('renders null and undefined as empty', () => {
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(undefined)).toBe('');
  });
});

describe('todosToCsv', () => {
  it('emits the fixed column order as the header row', () => {
    const [header] = todosToCsv([]).split('\r\n');
    expect(header).toBe(CSV_COLUMNS.join(','));
  });

  it('round-trips a title containing a comma, a quote and a newline', () => {
    const csv = todosToCsv([makeTodo({ title: 'Buy milk, eggs, "bread"\nand jam' })]);
    expect(csv).toContain('"Buy milk, eggs, ""bread""\nand jam"');
  });

  it('renders booleans, recurrence and reminders in human-readable form', () => {
    const csv = todosToCsv([
      makeTodo({
        title: 'Weekly report',
        completed: true,
        due_date: '2026-03-05T09:00:00',
        priority: 'high',
        is_recurring: true,
        recurrence_pattern: 'weekly',
        reminder_minutes: 60,
      }),
    ]);

    const row = csv.split('\r\n')[1];
    expect(row).toContain('Weekly report');
    expect(row).toContain('Yes');
    expect(row).toContain('weekly');
    expect(row).toContain('1h');
  });
});
