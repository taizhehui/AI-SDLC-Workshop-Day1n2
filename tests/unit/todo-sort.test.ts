import { describe, expect, it } from 'vitest';
import { sectionTodos, sortTodos } from '@/lib/todo-sort';
import { parseSingaporeDate } from '@/lib/timezone';
import { makeTodo } from './factories';

describe('sortTodos', () => {
  it('orders by priority, then due date, then creation date', () => {
    const todos = [
      makeTodo({ title: 'Low, no due date', priority: 'low', due_date: null }),
      makeTodo({ title: 'Medium, next week', priority: 'medium', due_date: '2026-03-08T09:00:00' }),
      makeTodo({ title: 'High, tomorrow', priority: 'high', due_date: '2026-03-02T09:00:00' }),
      makeTodo({ title: 'Low, tomorrow', priority: 'low', due_date: '2026-03-02T09:00:00' }),
      makeTodo({ title: 'High, today', priority: 'high', due_date: '2026-03-01T09:00:00' }),
      makeTodo({ title: 'Medium, today', priority: 'medium', due_date: '2026-03-01T09:00:00' }),
    ];

    expect(sortTodos(todos).map((todo) => todo.title)).toEqual([
      'High, today',
      'High, tomorrow',
      'Medium, today',
      'Medium, next week',
      'Low, tomorrow',
      'Low, no due date',
    ]);
  });

  it('sorts a todo without a due date after one with a due date at the same priority', () => {
    const withDue = makeTodo({ title: 'dated', priority: 'medium', due_date: '2026-05-01T09:00:00' });
    const withoutDue = makeTodo({ title: 'undated', priority: 'medium', due_date: null });

    expect(sortTodos([withoutDue, withDue]).map((t) => t.title)).toEqual(['dated', 'undated']);
  });

  it('breaks ties on identical priority and due date by newest created first', () => {
    const older = makeTodo({
      title: 'older',
      due_date: '2026-05-01T09:00:00',
      created_at: '2026-01-01T09:00:00',
    });
    const newer = makeTodo({
      title: 'newer',
      due_date: '2026-05-01T09:00:00',
      created_at: '2026-02-01T09:00:00',
    });

    expect(sortTodos([older, newer]).map((t) => t.title)).toEqual(['newer', 'older']);
  });

  it('does not mutate its input', () => {
    const todos = [
      makeTodo({ title: 'low', priority: 'low' }),
      makeTodo({ title: 'high', priority: 'high' }),
    ];
    const snapshot = [...todos];

    sortTodos(todos);
    expect(todos).toEqual(snapshot);
  });
});

describe('sectionTodos', () => {
  const now = parseSingaporeDate('2026-03-01T12:00:00');

  it('buckets todos into overdue, pending and completed', () => {
    const overdue = makeTodo({ title: 'overdue', due_date: '2026-02-28T09:00:00' });
    const pending = makeTodo({ title: 'pending', due_date: '2026-03-05T09:00:00' });
    const undated = makeTodo({ title: 'undated', due_date: null });
    const done = makeTodo({ title: 'done', completed: true, due_date: '2026-01-01T09:00:00' });

    const sections = sectionTodos([overdue, pending, undated, done], now);

    expect(sections.overdue.map((t) => t.title)).toEqual(['overdue']);
    expect(sections.pending.map((t) => t.title)).toContain('pending');
    // No due date means Pending forever, never Overdue.
    expect(sections.pending.map((t) => t.title)).toContain('undated');
    expect(sections.completed.map((t) => t.title)).toEqual(['done']);
  });

  it('treats the exact due-date boundary as pending, not overdue', () => {
    const exactlyNow = makeTodo({ title: 'boundary', due_date: '2026-03-01T12:00:00' });
    const oneSecondAgo = makeTodo({ title: 'just past', due_date: '2026-03-01T11:59:59' });

    const sections = sectionTodos([exactlyNow, oneSecondAgo], now);

    expect(sections.pending.map((t) => t.title)).toEqual(['boundary']);
    expect(sections.overdue.map((t) => t.title)).toEqual(['just past']);
  });

  it('returns an incomplete past-due todo to overdue, not pending', () => {
    const reopened = makeTodo({ title: 'reopened', completed: false, due_date: '2026-01-05T09:00:00' });
    expect(sectionTodos([reopened], now).overdue).toHaveLength(1);
  });

  it('orders completed todos by completion time, newest first', () => {
    const first = makeTodo({ title: 'first', completed: true, updated_at: '2026-02-01T09:00:00' });
    const second = makeTodo({ title: 'second', completed: true, updated_at: '2026-02-10T09:00:00' });

    expect(sectionTodos([first, second], now).completed.map((t) => t.title)).toEqual([
      'second',
      'first',
    ]);
  });
});
