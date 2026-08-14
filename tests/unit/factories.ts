import type { Subtask, Tag, Todo } from '@/lib/db/types';

/** Test data builders — keep specs focused on the assertion rather than object literals. */

let nextId = 1;
const takeId = (): number => nextId++;

export function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: takeId(),
    user_id: 1,
    title: 'Test todo',
    completed: false,
    due_date: null,
    priority: 'medium',
    is_recurring: false,
    recurrence_pattern: null,
    reminder_minutes: null,
    last_notification_sent: null,
    created_at: '2026-01-01T09:00:00',
    updated_at: null,
    subtasks: [],
    tags: [],
    ...overrides,
  };
}

export function makeSubtask(overrides: Partial<Subtask> = {}): Subtask {
  return {
    id: takeId(),
    todo_id: 1,
    title: 'Test subtask',
    completed: false,
    position: 0,
    created_at: '2026-01-01T09:00:00',
    ...overrides,
  };
}

export function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: takeId(),
    user_id: 1,
    name: 'Work',
    color: '#3B82F6',
    created_at: '2026-01-01T09:00:00',
    ...overrides,
  };
}
