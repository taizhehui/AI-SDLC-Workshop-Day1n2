import { describe, expect, it } from 'vitest';
import {
  createTagSchema,
  importSchema,
  isDueDateFarEnoughOut,
  validatePriority,
} from '@/lib/validation';
import { validateNewTodo, validateRecurrence } from '@/lib/todo-rules';
import { parseSingaporeDate } from '@/lib/timezone';

describe('validatePriority', () => {
  it('accepts the three valid levels', () => {
    expect(validatePriority('high')).toBe('high');
    expect(validatePriority('medium')).toBe('medium');
    expect(validatePriority('low')).toBe('low');
  });

  it('defaults an unspecified priority to medium', () => {
    expect(validatePriority(undefined)).toBe('medium');
    expect(validatePriority(null)).toBe('medium');
  });

  it('rejects anything else, case-sensitively', () => {
    expect(() => validatePriority('urgent')).toThrow(/Invalid priority: urgent/);
    expect(() => validatePriority('HIGH')).toThrow(/Invalid priority/);
    expect(() => validatePriority('')).toThrow(/Invalid priority/);
  });
});

describe('isDueDateFarEnoughOut', () => {
  const now = parseSingaporeDate('2026-03-01T12:00:00');

  it('rejects a due date less than one minute out', () => {
    expect(isDueDateFarEnoughOut('2026-03-01T12:00:30', now)).toBe(false);
    expect(isDueDateFarEnoughOut('2026-03-01T11:00:00', now)).toBe(false);
  });

  it('accepts a due date exactly one minute out', () => {
    expect(isDueDateFarEnoughOut('2026-03-01T12:01:00', now)).toBe(true);
  });

  it('accepts a due date comfortably in the future', () => {
    expect(isDueDateFarEnoughOut('2026-04-01T09:00:00', now)).toBe(true);
  });
});

describe('validateRecurrence', () => {
  it('passes when recurrence is off', () => {
    expect(validateRecurrence(false, null, null)).toBeNull();
  });

  it('requires a due date when recurrence is on', () => {
    expect(validateRecurrence(true, 'weekly', null)?.message).toBe(
      'Recurring todos require a due date',
    );
  });

  it('requires a valid pattern when recurrence is on', () => {
    expect(validateRecurrence(true, null, '2026-03-01T09:00:00')?.message).toBe(
      'Invalid recurrence pattern',
    );
  });

  it('passes for a valid recurring configuration', () => {
    expect(validateRecurrence(true, 'monthly', '2026-03-01T09:00:00')).toBeNull();
  });
});

describe('validateNewTodo', () => {
  it('rejects an invalid priority', () => {
    const violation = validateNewTodo({
      due_date: null,
      is_recurring: false,
      recurrence_pattern: null,
      priority: 'urgent',
    });
    expect(violation?.message).toMatch(/Invalid priority/);
  });

  it('rejects a due date in the past', () => {
    const violation = validateNewTodo({
      due_date: '2020-01-01T09:00:00',
      is_recurring: false,
      recurrence_pattern: null,
      priority: 'medium',
    });
    expect(violation?.message).toBe('Due date must be at least 1 minute in the future');
  });
});

describe('createTagSchema', () => {
  it('accepts a valid hex colour', () => {
    expect(createTagSchema.safeParse({ name: 'Work', color: '#3B82F6' }).success).toBe(true);
  });

  it('rejects a non-hex colour', () => {
    expect(createTagSchema.safeParse({ name: 'Work', color: 'red' }).success).toBe(false);
    expect(createTagSchema.safeParse({ name: 'Work', color: '#ZZZ' }).success).toBe(false);
  });

  it('rejects an empty or whitespace-only name', () => {
    expect(createTagSchema.safeParse({ name: '' }).success).toBe(false);
    expect(createTagSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('trims the name', () => {
    const parsed = createTagSchema.parse({ name: '  Work  ' });
    expect(parsed.name).toBe('Work');
  });
});

describe('importSchema', () => {
  const validPayload = {
    version: 1,
    exported_at: '2026-03-01T09:00:00',
    todos: [
      {
        title: 'Imported todo',
        completed: false,
        due_date: null,
        priority: 'high',
        is_recurring: false,
        recurrence_pattern: null,
        reminder_minutes: null,
        created_at: '2026-03-01T09:00:00',
        subtasks: [{ title: 'Step one', completed: false, position: 0 }],
        tags: [{ name: 'Work', color: '#3B82F6' }],
      },
    ],
  };

  it('accepts a well-formed payload', () => {
    expect(importSchema.safeParse(validPayload).success).toBe(true);
  });

  it('accepts an empty todos array', () => {
    expect(importSchema.safeParse({ ...validPayload, todos: [] }).success).toBe(true);
  });

  it('rejects a wrong version', () => {
    expect(importSchema.safeParse({ ...validPayload, version: 2 }).success).toBe(false);
  });

  it('rejects an invalid priority enum value', () => {
    const payload = structuredClone(validPayload);
    payload.todos[0].priority = 'urgent';
    expect(importSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a missing todos array', () => {
    expect(importSchema.safeParse({ version: 1, exported_at: 'x' }).success).toBe(false);
  });
});
