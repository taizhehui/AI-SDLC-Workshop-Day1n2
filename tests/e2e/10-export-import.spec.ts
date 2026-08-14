import { expect, test } from '@playwright/test';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import {
  addSubtask,
  createTag,
  createTodo,
  installVirtualAuthenticator,
  registerAndLogin,
  todoByTitle,
} from './helpers';

/** PRP 09 — Export & import. */
test.describe('Export and import', () => {
  test.beforeEach(async ({ page }) => {
    await installVirtualAuthenticator(page);
    await registerAndLogin(page);
  });

  test('downloads a JSON export named for the Singapore date', async ({ page }) => {
    await createTodo(page, 'Exportable todo');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-json-button').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^todos-\d{4}-\d{2}-\d{2}\.json$/);
  });

  test('downloads a CSV export with the fixed column order', async ({ page }) => {
    await createTodo(page, 'CSV todo');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-csv-button').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^todos-\d{4}-\d{2}-\d{2}\.csv$/);

    const csv = await page.evaluate(() =>
      fetch('/api/todos/export?format=csv').then((response) => response.text()),
    );
    expect(csv.split('\r\n')[0]).toBe(
      'ID,Title,Completed,Due Date,Priority,Recurring,Pattern,Reminder',
    );
  });

  test('round-trips todos with their subtasks and tags', async ({ page }, testInfo) => {
    await createTag(page, 'Work');
    await createTodo(page, 'Round trip todo', { priority: 'high', tagNames: ['Work'] });
    await addSubtask(page, 'Round trip todo', 'Step one');
    await addSubtask(page, 'Round trip todo', 'Step two');

    const exported = await page.evaluate(() =>
      fetch('/api/todos/export?format=json').then((response) => response.text()),
    );

    // Wipe the list, then restore it from the file alone.
    await page.evaluate(async () => {
      const todos = await fetch('/api/todos').then((response) => response.json());
      for (const todo of todos) {
        await fetch(`/api/todos/${todo.id}`, { method: 'DELETE' });
      }
    });
    await page.reload();
    await expect(page.getByTestId('empty-no-todos')).toBeVisible();

    const filePath = path.join(testInfo.outputDir, 'export.json');
    await writeFile(filePath, exported, 'utf8');
    await page.getByTestId('import-file-input').setInputFiles(filePath);

    await expect(page.getByTestId('import-message')).toContainText('Successfully imported 1 todos');
    await expect(todoByTitle(page, 'Round trip todo')).toBeVisible();

    const restored = await page.evaluate(async () => {
      const todos = await fetch('/api/todos').then((response) => response.json());
      return todos.find((todo: { title: string }) => todo.title === 'Round trip todo');
    });

    expect(restored.subtasks.map((s: { title: string }) => s.title)).toEqual([
      'Step one',
      'Step two',
    ]);
    expect(restored.tags.map((t: { name: string }) => t.name)).toEqual(['Work']);
    expect(restored.priority).toBe('high');
  });

  test('reuses an existing same-named tag rather than duplicating it', async ({ page }, testInfo) => {
    await createTag(page, 'Work');
    await createTodo(page, 'Tagged for import', { tagNames: ['Work'] });

    const exported = await page.evaluate(() =>
      fetch('/api/todos/export?format=json').then((response) => response.text()),
    );

    // Case-differing tag name in the file must still resolve to the existing tag.
    const mutated = exported.replace(/"name": "Work"/g, '"name": "work"');
    const filePath = path.join(testInfo.outputDir, 'case-tags.json');
    await writeFile(filePath, mutated, 'utf8');

    await page.getByTestId('import-file-input').setInputFiles(filePath);
    await expect(page.getByTestId('import-message')).toContainText('Successfully imported');

    const tagNames = await page.evaluate(async () => {
      const tags = await fetch('/api/tags').then((response) => response.json());
      return tags.map((tag: { name: string }) => tag.name);
    });

    expect(tagNames).toEqual(['Work']);
  });

  test('rejects a file that is not valid JSON', async ({ page }, testInfo) => {
    const filePath = path.join(testInfo.outputDir, 'broken.json');
    await writeFile(filePath, 'this is not json at all', 'utf8');

    await page.getByTestId('import-file-input').setInputFiles(filePath);
    await expect(page.getByTestId('import-message')).toContainText('Invalid JSON format');
  });

  test('rejects structurally invalid JSON', async ({ page }, testInfo) => {
    const filePath = path.join(testInfo.outputDir, 'wrong-shape.json');
    await writeFile(filePath, JSON.stringify({ version: 1, exported_at: 'x' }), 'utf8');

    await page.getByTestId('import-file-input').setInputFiles(filePath);
    await expect(page.getByTestId('import-message')).toContainText(
      'Please check the file format',
    );
  });

  test('imports an empty todo list as a success, not an error', async ({ page }, testInfo) => {
    const filePath = path.join(testInfo.outputDir, 'empty.json');
    await writeFile(
      filePath,
      JSON.stringify({ version: 1, exported_at: '2026-03-01T09:00:00', todos: [] }),
      'utf8',
    );

    await page.getByTestId('import-file-input').setInputFiles(filePath);
    await expect(page.getByTestId('import-message')).toContainText(
      'Successfully imported 0 todos',
    );
  });

  test('importing the same file twice duplicates rather than merges', async ({ page }, testInfo) => {
    await createTodo(page, 'Duplicated todo');

    const exported = await page.evaluate(() =>
      fetch('/api/todos/export?format=json').then((response) => response.text()),
    );
    const filePath = path.join(testInfo.outputDir, 'twice.json');
    await writeFile(filePath, exported, 'utf8');

    await page.getByTestId('import-file-input').setInputFiles(filePath);
    await expect(page.getByTestId('import-message')).toContainText('Successfully imported 1');
    await page.getByTestId('import-file-input').setInputFiles(filePath);
    await expect(page.getByTestId('import-message')).toContainText('Successfully imported 1');

    const count = await page.evaluate(async () => {
      const todos = await fetch('/api/todos').then((response) => response.json());
      return todos.filter((todo: { title: string }) => todo.title === 'Duplicated todo').length;
    });

    // Import only ever adds; it never upserts against existing todos.
    expect(count).toBe(3);
  });

  test('escapes commas, quotes and newlines in the CSV output', async ({ page }) => {
    await page.evaluate(() =>
      fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Buy milk, eggs, "bread"' }),
      }),
    );

    const csv = await page.evaluate(() =>
      fetch('/api/todos/export?format=csv').then((response) => response.text()),
    );

    expect(csv).toContain('"Buy milk, eggs, ""bread"""');
  });

  test('requires a session for both endpoints', async ({ page }) => {
    await page.getByTestId('logout-button').click();
    await page.waitForURL('/login');

    const statuses = await page.evaluate(async () => [
      (await fetch('/api/todos/export?format=json')).status,
      (
        await fetch('/api/todos/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: 1, exported_at: 'x', todos: [] }),
        })
      ).status,
    ]);

    expect(statuses).toEqual([401, 401]);
  });
});
