import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTER_STATE, applyFilters, hasActiveFilters } from '@/lib/filters';
import { makeSubtask, makeTag, makeTodo } from './factories';

const workTag = makeTag({ name: 'Work' });
const homeTag = makeTag({ name: 'Home' });

const meeting = makeTodo({
  title: 'Team meeting',
  priority: 'high',
  due_date: '2026-03-05T09:00:00',
  tags: [workTag],
  subtasks: [makeSubtask({ title: 'Prepare agenda' })],
});
const groceries = makeTodo({
  title: 'Buy groceries',
  priority: 'low',
  due_date: '2026-03-10T18:00:00',
  completed: true,
  tags: [homeTag],
});
const undated = makeTodo({ title: 'Someday project', priority: 'medium', due_date: null });

const all = [meeting, groceries, undated];
const withFilters = (patch: Partial<typeof DEFAULT_FILTER_STATE>) => ({
  ...DEFAULT_FILTER_STATE,
  ...patch,
});

describe('applyFilters — search', () => {
  it('returns everything for an empty query', () => {
    expect(applyFilters(all, DEFAULT_FILTER_STATE)).toHaveLength(3);
  });

  it('matches a partial todo title', () => {
    expect(applyFilters(all, withFilters({ search: 'meet' }))).toEqual([meeting]);
  });

  it('is case-insensitive', () => {
    expect(applyFilters(all, withFilters({ search: 'MEETING' }))).toEqual([meeting]);
  });

  it('matches a subtask title and returns the parent todo', () => {
    expect(applyFilters(all, withFilters({ search: 'agenda' }))).toEqual([meeting]);
  });

  it('treats a whitespace-only query as empty', () => {
    expect(applyFilters(all, withFilters({ search: '   ' }))).toHaveLength(3);
  });

  it('returns nothing when there is no match', () => {
    expect(applyFilters(all, withFilters({ search: 'zzzz' }))).toEqual([]);
  });
});

describe('applyFilters — priority, tag, completion', () => {
  it('filters by priority', () => {
    expect(applyFilters(all, withFilters({ priority: 'high' }))).toEqual([meeting]);
    expect(applyFilters(all, withFilters({ priority: 'low' }))).toEqual([groceries]);
    expect(applyFilters(all, withFilters({ priority: 'all' }))).toHaveLength(3);
  });

  it('filters by tag', () => {
    expect(applyFilters(all, withFilters({ tagId: workTag.id }))).toEqual([meeting]);
    expect(applyFilters(all, withFilters({ tagId: -999 }))).toEqual([]);
  });

  it('filters by completion status', () => {
    expect(applyFilters(all, withFilters({ completion: 'completed' }))).toEqual([groceries]);
    expect(applyFilters(all, withFilters({ completion: 'incomplete' }))).toEqual([
      meeting,
      undated,
    ]);
  });
});

describe('applyFilters — date range', () => {
  it('supports a from bound alone', () => {
    expect(applyFilters(all, withFilters({ dueDateFrom: '2026-03-08' }))).toEqual([groceries]);
  });

  it('supports a to bound alone', () => {
    expect(applyFilters(all, withFilters({ dueDateTo: '2026-03-06' }))).toEqual([meeting]);
  });

  it('supports both bounds', () => {
    expect(
      applyFilters(all, withFilters({ dueDateFrom: '2026-03-01', dueDateTo: '2026-03-31' })),
    ).toEqual([meeting, groceries]);
  });

  it('excludes todos with no due date', () => {
    const result = applyFilters(all, withFilters({ dueDateFrom: '2020-01-01' }));
    expect(result).not.toContain(undated);
  });

  it('yields nothing when from is after to, without throwing', () => {
    expect(
      applyFilters(all, withFilters({ dueDateFrom: '2026-04-01', dueDateTo: '2026-03-01' })),
    ).toEqual([]);
  });
});

describe('applyFilters — combined', () => {
  it('applies every active filter as a strict AND intersection', () => {
    const result = applyFilters(
      all,
      withFilters({
        search: 'meeting',
        priority: 'high',
        tagId: workTag.id,
        completion: 'incomplete',
        dueDateFrom: '2026-03-01',
        dueDateTo: '2026-03-31',
      }),
    );
    expect(result).toEqual([meeting]);
  });

  it('narrows to nothing when one dimension excludes the match', () => {
    const result = applyFilters(
      all,
      withFilters({ search: 'meeting', priority: 'low' }),
    );
    expect(result).toEqual([]);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the default state', () => {
    expect(hasActiveFilters(DEFAULT_FILTER_STATE)).toBe(false);
  });

  it('is false for a whitespace-only search', () => {
    expect(hasActiveFilters(withFilters({ search: '   ' }))).toBe(false);
  });

  it('is true for each dimension individually', () => {
    expect(hasActiveFilters(withFilters({ search: 'x' }))).toBe(true);
    expect(hasActiveFilters(withFilters({ priority: 'high' }))).toBe(true);
    expect(hasActiveFilters(withFilters({ tagId: 1 }))).toBe(true);
    expect(hasActiveFilters(withFilters({ completion: 'completed' }))).toBe(true);
    expect(hasActiveFilters(withFilters({ dueDateFrom: '2026-01-01' }))).toBe(true);
    expect(hasActiveFilters(withFilters({ dueDateTo: '2026-01-01' }))).toBe(true);
  });
});
