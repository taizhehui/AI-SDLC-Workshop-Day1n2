import { REMINDER_LABELS, type ReminderMinutes, type Todo } from './db/types';

/**
 * RFC 4180 CSV serialization for the one-way spreadsheet export (PRP 09).
 *
 * CSV is never re-importable — the `ID` column is included for human reference only.
 */

export const CSV_COLUMNS = [
  'ID',
  'Title',
  'Completed',
  'Due Date',
  'Priority',
  'Recurring',
  'Pattern',
  'Reminder',
] as const;

/**
 * Quote a single field per RFC 4180: wrap in double quotes when it contains a comma, a
 * double quote, CR or LF, and double any embedded quotes.
 */
export function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsvRow(values: Array<string | number | null | undefined>): string {
  return values.map(escapeCsvValue).join(',');
}

export function todosToCsv(todos: Todo[]): string {
  const rows = [toCsvRow([...CSV_COLUMNS])];

  for (const todo of todos) {
    rows.push(
      toCsvRow([
        todo.id,
        todo.title,
        todo.completed ? 'Yes' : 'No',
        todo.due_date ?? '',
        todo.priority,
        todo.is_recurring ? 'Yes' : 'No',
        todo.recurrence_pattern ?? '',
        todo.reminder_minutes != null
          ? (REMINDER_LABELS[todo.reminder_minutes as ReminderMinutes] ??
            `${todo.reminder_minutes}m`)
          : '',
      ]),
    );
  }

  // CRLF line endings keep Excel happy across platforms.
  return `${rows.join('\r\n')}\r\n`;
}
