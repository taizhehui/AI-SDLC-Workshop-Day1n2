import { describe, expect, it } from 'vitest';
import { calculateProgress } from '@/lib/progress';
import { makeSubtask } from './factories';

const subtasks = (total: number, completed: number) =>
  Array.from({ length: total }, (_, index) =>
    makeSubtask({ completed: index < completed }),
  );

describe('calculateProgress', () => {
  it('reports zeroes for an empty checklist', () => {
    expect(calculateProgress([])).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it('treats an undefined checklist as empty', () => {
    expect(calculateProgress(undefined)).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it('reports 0% when nothing is done', () => {
    expect(calculateProgress(subtasks(4, 0))).toEqual({ completed: 0, total: 4, percent: 0 });
  });

  it('rounds partial completion', () => {
    expect(calculateProgress(subtasks(7, 3))).toEqual({ completed: 3, total: 7, percent: 43 });
  });

  it('rounds thirds predictably', () => {
    expect(calculateProgress(subtasks(3, 1)).percent).toBe(33);
    expect(calculateProgress(subtasks(3, 2)).percent).toBe(67);
  });

  it('reports 100% when everything is done', () => {
    expect(calculateProgress(subtasks(5, 5))).toEqual({ completed: 5, total: 5, percent: 100 });
  });
});
