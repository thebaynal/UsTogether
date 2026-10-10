import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect, photoPath, SPACE_ID } from '../fixtures/backend';

const timeline = `/spaces/${SPACE_ID}`;
async function choosePhoto(page: Page) {
  const chosen = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose a photo' }).click();
  await (await chosen).setFiles(photoPath);
  await expect(page.getByRole('img', { name: 'Selected photo preview' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('A browser fixture memory');
  await page.getByRole('textbox', { name: 'Date', exact: true }).fill('2026-04-03');
}

test('browser photo saving sends original bytes, prevents duplicates, and survives return/reload', async ({ page, backend }) => {
  await page.goto(`${timeline}/new-memory`);
  await choosePhoto(page);
  const release = backend.holdNext('POST', '/rest/v1/memories');
  const save = page.getByRole('button', { name: 'Save memory', exact: true });
  await save.click();
  await expect(save).toHaveAttribute('aria-disabled', 'true');
  await save.press('Enter');
  await expect.poll(() => backend.count('POST', '/rest/v1/memories')).toBe(1);
  const uploads = backend.requests.filter((request) => request.method === 'POST' && request.path.startsWith('/storage/v1/object/memory-images/'));
  expect(uploads).toHaveLength(1);
  expect(backend.uploads).toEqual([{
    path: uploads[0].path, name: 'photo.png', type: 'image/png', size: readFileSync(photoPath).length,
    sha256: createHash('sha256').update(readFileSync(photoPath)).digest('hex')
  }]);
  release();
  await expect(page.getByText('A moment, kept forever.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to your timeline' }).click();
  await expect(page).toHaveURL(timeline);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Show details for A browser fixture memory' })).toBeAttached();
  expect(backend.memories.filter((memory) => memory.title === 'A browser fixture memory')).toHaveLength(1);
});

test('failed database save cleans its uploaded photo and retains editable form values', async ({ page, backend }) => {
  backend.failNext('POST', '/rest/v1/memories', { status: 403, message: 'Fixture insert denied' });
  await page.goto(`${timeline}/new-memory`);
  await choosePhoto(page);
  await page.getByRole('button', { name: 'Save memory', exact: true }).click();
  await expect(page.getByText('Fixture insert denied', { exact: true })).toBeVisible();
  await expect.poll(() => backend.count('DELETE', '/storage/v1/object/memory-images')).toBe(1);
  const cleanup = backend.requests.find((request) => request.method === 'DELETE' && request.path === '/storage/v1/object/memory-images');
  expect(cleanup?.body?.prefixes).toHaveLength(1);
  expect(backend.memories).toHaveLength(3);
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('A browser fixture memory');
  await expect(page.getByRole('button', { name: 'Save memory', exact: true })).toBeEnabled();
});

test('failed upload never inserts a memory and exposes a retryable error', async ({ page, backend }) => {
  backend.failNext('POST', '/storage/v1/object/memory-images/', { status: 503, message: 'Fixture storage unavailable' });
  await page.goto(`${timeline}/new-memory`);
  await choosePhoto(page);
  await page.getByRole('button', { name: 'Save memory', exact: true }).click();
  await expect(page.getByText(/Your photo could not be uploaded:.*Fixture storage unavailable/)).toBeVisible();
  expect(backend.count('POST', '/rest/v1/memories')).toBe(0);
  await expect(page.getByRole('button', { name: 'Save memory', exact: true })).toBeEnabled();
});

test('preview failure after insertion remains a successful save with no repeat-save control', async ({ page, backend }) => {
  backend.failNext('POST', '/storage/v1/object/sign/memory-images/', { status: 503, message: 'Fixture preview unavailable' });
  await page.goto(`${timeline}/new-memory`);
  await choosePhoto(page);
  await page.getByRole('button', { name: 'Save memory', exact: true }).click();
  await expect(page.getByText('A moment, kept forever.', { exact: true })).toBeVisible();
  await expect(page.getByText(/Your memory is saved.*photo preview could not load/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save memory', exact: true })).toHaveCount(0);
  expect(backend.count('POST', '/rest/v1/memories')).toBe(1);
  expect(backend.count('DELETE', '/storage/v1/object/memory-images')).toBe(0);
  await page.getByRole('button', { name: 'Back to your timeline' }).click();
  await expect(page.getByRole('button', { name: 'Show details for A browser fixture memory' })).toBeAttached();
});

test('oversized picker file is rejected before any upload', async ({ page, backend }) => {
  await page.goto(`${timeline}/new-memory`);
  const chosen = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose a photo' }).click();
  await (await chosen).setFiles({ name: 'oversized.png', mimeType: 'image/png', buffer: Buffer.concat([readFileSync(photoPath), Buffer.alloc(10 * 1024 * 1024)]) });
  await expect(page.getByText('Images must be 10 MB or smaller.', { exact: true })).toBeVisible();
  expect(backend.requests.filter((request) => request.method === 'POST' && request.path.startsWith('/storage/'))).toHaveLength(0);
});

const palettes = [
  ['rose', 'Rose letters', 'rgb(250, 244, 233)'], ['lavender', 'Lilac daydream', 'rgb(245, 240, 233)'],
  ['peach', 'Peach picnic', 'rgb(251, 241, 227)'], ['mint', 'Mint meadow', 'rgb(240, 243, 232)'], ['sky', 'Blue hour', 'rgb(239, 242, 237)']
];
test('all five palettes require confirmed persistence and reach the refreshed timeline', async ({ page, backend }) => {
  await page.goto(timeline);
  for (const [key, label, background] of palettes) {
    await page.getByRole('button', { name: 'Show album controls' }).click();
    await page.getByRole('button', { name: 'Album options', exact: true }).click();
    await page.getByRole('button', { name: 'Change space theme' }).click();
    const radio = page.getByRole('radio', { name: label, exact: true });
    await radio.click();
    await expect(radio).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Use this palette' }).click();
    await expect(page).toHaveURL(timeline);
    expect(backend.space.theme_key).toBe(key);
    await expect(page.getByTestId('page')).toHaveCSS('background-color', background);
    await page.reload();
    await expect(page.getByTestId('page')).toHaveCSS('background-color', background);
  }
});

test('mismatched theme update stays on the form and cannot report success', async ({ page, backend }) => {
  backend.themeResponseOverride = 'rose';
  await page.goto(`${timeline}/theme`);
  await page.getByRole('radio', { name: 'Mint meadow' }).click();
  await page.getByRole('button', { name: 'Use this palette' }).click();
  await expect(page.getByText(/Your theme was not saved/)).toBeVisible();
  await expect(page).toHaveURL(`${timeline}/theme`);
  await expect(page.getByRole('button', { name: 'Use this palette' })).toBeEnabled();
});

test('Realtime theme refresh updates the timeline without closing selected details', async ({ page, backend }) => {
  await page.goto(timeline);
  await page.getByRole('button', { name: 'Show details for Sunrise together' }).click();
  await expect.poll(() => backend.subscribed).toBeGreaterThan(0);
  backend.space.theme_key = 'mint';
  backend.emit('spaces');
  await expect(page.getByTestId('page')).toHaveCSS('background-color', 'rgb(240, 243, 232)');
  await expect(page.getByRole('button', { name: 'Hide details for Sunrise together' })).toHaveAttribute('aria-expanded', 'true');
});
