import { describe, expect, it } from 'vitest';
import { parseTemplateSubtasks, serializeTemplateSubtasks } from '@/lib/template-subtasks';

describe('serializeTemplateSubtasks', () => {
  it('returns null for an empty or missing list', () => {
    expect(serializeTemplateSubtasks(undefined)).toBeNull();
    expect(serializeTemplateSubtasks([])).toBeNull();
  });

  it('re-normalizes positions to array order', () => {
    const json = serializeTemplateSubtasks([
      { title: 'Second', position: 42 },
      { title: 'First', position: 7 },
    ]);

    expect(JSON.parse(json as string)).toEqual([
      { title: 'Second', position: 0 },
      { title: 'First', position: 1 },
    ]);
  });
});

describe('parseTemplateSubtasks', () => {
  it('round-trips a serialized list losslessly', () => {
    const original = [
      { title: 'Draft outline', position: 0 },
      { title: 'Review with team', position: 1 },
    ];
    expect(parseTemplateSubtasks(serializeTemplateSubtasks(original))).toEqual(original);
  });

  it('returns an empty list for null', () => {
    expect(parseTemplateSubtasks(null)).toEqual([]);
  });

  it('falls back to an empty list on malformed JSON instead of throwing', () => {
    expect(parseTemplateSubtasks('{not json')).toEqual([]);
    expect(parseTemplateSubtasks('"a string"')).toEqual([]);
  });

  it('drops entries without a usable title', () => {
    const json = JSON.stringify([
      { title: 'Keep me', position: 0 },
      { title: '   ', position: 1 },
      { position: 2 },
      null,
    ]);
    expect(parseTemplateSubtasks(json)).toEqual([{ title: 'Keep me', position: 0 }]);
  });

  it('sorts by stored position', () => {
    const json = JSON.stringify([
      { title: 'Last', position: 5 },
      { title: 'First', position: 1 },
    ]);
    expect(parseTemplateSubtasks(json).map((s) => s.title)).toEqual(['First', 'Last']);
  });
});
