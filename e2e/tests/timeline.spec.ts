import type { Page } from '@playwright/test';
import { test, expect, MEMORY_IDS, SPACE_ID } from '../fixtures/backend';

const timeline = `/spaces/${SPACE_ID}`;
const photo = (page: Page, index = 0) => page.getByTestId(`photo-toggle-${MEMORY_IDS[index]}`);
const offset = (page: Page) => page.getByTestId('memory-photo-rail').evaluate((element) => element.scrollLeft);

test('create-space CTA is centered for empty and populated albums', async ({ page, backend }) => {
  for (const membership of [true, false]) {
    backend.hasMembership = membership;
    await page.goto('/spaces');
    const button = page.getByRole('button', { name: /Create a space/ });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box!.x + box!.width / 2 - page.viewportSize()!.width / 2)).toBeLessThanOrEqual(2);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('photos dominate a centered stage; details and album actions appear only after activation', async ({ page }) => {
  await page.goto(timeline);
  await expect(photo(page)).toBeVisible();
  await expect(photo(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('A quiet beginning by the sea.', { exact: true })).toBeHidden();
  await expect(page.getByText('First adventure', { exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Add a memory', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Create an invite link' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Leave space', exact: true })).toBeHidden();
  const stage = await page.getByTestId('timeline-stage').boundingBox();
  const initialRail = await page.getByTestId('memory-photo-rail').boundingBox();
  expect(stage).not.toBeNull();
  expect(Math.abs(stage!.x + stage!.width / 2 - page.viewportSize()!.width / 2)).toBeLessThanOrEqual(2);
  expect(stage!.height).toBeGreaterThan(320);
  const size = page.viewportSize()!.width < 600 ? 'mobile' : 'desktop';
  // Proof artifacts show settled contrast, rather than a frame halfway
  // through the initial 300 ms entrance. Behavioral assertions stay unchanged.
  await page.waitForTimeout(350);
  await page.screenshot({ path: `.tmp/photo-first-${size}-idle.png`, fullPage: true });
  await photo(page).click();
  await expect(photo(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('A quiet beginning by the sea.', { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add a memory', exact: true })).toBeVisible();
  await expect(page).toHaveURL(timeline);
  const revealed = await page.getByTestId('memory-photo-rail').boundingBox();
  expect(Math.abs(revealed!.y - initialRail!.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(revealed!.height - initialRail!.height)).toBeLessThanOrEqual(2);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `.tmp/photo-first-${size}.png`, fullPage: true });
  await photo(page).click();
  await expect(photo(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('A quiet beginning by the sea.', { exact: true })).toBeHidden();
});

test('keyboard toggles details and Escape restores photo focus', async ({ page }) => {
  await page.goto(timeline);
  await expect(photo(page)).toBeVisible();
  await photo(page).focus();
  await photo(page).press('Enter');
  await expect(photo(page)).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(photo(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(photo(page)).toBeFocused();
  await photo(page).press('Space');
  await expect(photo(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Open memory', exact: true })).toBeVisible();
});

test('toolbar actions navigate without toggling the photo; options restore focus', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(timeline);
  const trigger = page.getByRole('button', { name: 'Show album controls' });
  await trigger.click();
  await page.getByRole('button', { name: 'Album options', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave space', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Album options', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Create an invite link' }).click();
  await expect(page.getByText(/Invite link copied/)).toBeVisible();
  await page.getByRole('button', { name: 'Add a memory', exact: true }).click();
  await expect(page).toHaveURL(`${timeline}/new-memory`);
  await expect(page.getByRole('button', { name: 'Choose a photo' })).toBeVisible();
});

test('memory details retain their direct route and returning refreshes the timeline', async ({ page, backend }) => {
  await page.goto(timeline);
  await photo(page).click();
  await page.getByRole('button', { name: 'Open memory', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/memories/${MEMORY_IDS[0]}`));
  await expect(page.getByText('A quiet beginning by the sea.', { exact: true }).filter({ visible: true })).toBeVisible();
  const reads = backend.count('GET', '/rest/v1/memories');
  await page.getByRole('button', { name: 'Back to timeline' }).click();
  await expect(page).toHaveURL(timeline);
  await expect.poll(() => backend.count('GET', '/rest/v1/memories')).toBeGreaterThan(reads);
});

test('keyboard and native web scrolling snap without revealing details; resize retains the active image', async ({ page, context }, testInfo) => {
  await page.goto(timeline);
  await expect(photo(page)).toBeVisible();
  const rail = page.getByTestId('memory-photo-rail');
  await photo(page).focus();
  await photo(page).press('ArrowRight');
  await expect.poll(() => offset(page)).toBeGreaterThan(100);
  await expect(photo(page, 1)).toHaveAttribute('aria-expanded', 'false');
  await photo(page, 1).click();
  await expect(photo(page, 1)).toHaveAttribute('aria-expanded', 'true');
  await page.setViewportSize({ width: testInfo.project.name.includes('mobile') ? 430 : 1100, height: 900 });
  await expect(photo(page, 1)).toHaveAttribute('aria-expanded', 'true');
  const centered = async () => {
    const stage = await rail.boundingBox();
    const current = await photo(page, 1).boundingBox();
    return Math.abs(current!.x + current!.width / 2 - (stage!.x + stage!.width / 2));
  };
  await expect.poll(centered).toBeLessThan(3);
  await page.keyboard.press('Escape');
  const before = await offset(page);
  const box = await rail.boundingBox();
  if (testInfo.project.name.includes('mobile')) {
    const cdp = await context.newCDPSession(page);
    const y = box!.y + Math.min(box!.height / 2, 260);
    const start = box!.x + box!.width * 0.8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] });
    for (let index = 1; index <= 8; index++) {
      // Give Chromium separate touch frames so this represents a physical drag,
      // rather than eight synthetic moves arriving in one rendering frame.
      await page.waitForTimeout(30);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: start - box!.width * 0.65 * index / 8, y }]
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await rail.hover();
    await page.mouse.wheel(box!.width * 0.75, 0);
  }
  await expect.poll(() => offset(page)).toBeGreaterThan(before + 100);
  await expect(page.getByRole('button', { name: /Hide details for/ })).toHaveCount(0);
  // The final photo must settle at the same centered snap position after native scrolling.
  try {
    await expect.poll(async () => {
      const stage = await rail.boundingBox();
      const current = await photo(page, 2).boundingBox();
      return Math.abs(current!.x + current!.width / 2 - stage!.x - stage!.width / 2);
    }).toBeLessThan(3);
  } finally {
    await testInfo.attach('native-scroll-geometry', {
      contentType: 'application/json', body: Buffer.from(JSON.stringify(await rail.evaluate((element) => ({
        left: element.scrollLeft, width: element.clientWidth, contentWidth: element.scrollWidth,
        snap: getComputedStyle(element).scrollSnapType, rect: element.getBoundingClientRect().toJSON(),
        cards: Array.from(element.querySelectorAll('[data-testid^="photo-card-"]')).map((card) => ({
          rect: card.getBoundingClientRect().toJSON(), snap: getComputedStyle(card.parentElement!).scrollSnapAlign,
          parentWidth: getComputedStyle(card.parentElement!).width
        }))
      })), null, 2))
    });
  }
  await expect(page).toHaveURL(timeline);
});

test('Realtime refresh preserves selected IDs, focus, and centered scroll after insertion', async ({ page, backend }) => {
  await page.goto(timeline);
  await photo(page).focus();
  await photo(page).press('ArrowRight');
  await photo(page, 1).click();
  await photo(page, 1).focus();
  await expect.poll(() => backend.subscribed).toBeGreaterThan(0);
  backend.memories[1].caption = 'A refreshed caption, same photograph.';
  backend.memories.unshift({ ...backend.memories[0], id: '55555555-5555-4555-8555-555555555555', memory_date: '2025-01-01', title: 'An earlier page' });
  backend.emit('memories', 'INSERT', backend.memories[0]);
  await expect(page.getByText('A refreshed caption, same photograph.', { exact: true })).toBeVisible();
  await expect(photo(page, 1)).toHaveAttribute('aria-expanded', 'true');
  await expect(photo(page, 1)).toBeFocused();
  await expect.poll(async () => {
    const rail = await page.getByTestId('memory-photo-rail').boundingBox();
    const current = await photo(page, 1).boundingBox();
    return Math.abs(current!.x + current!.width / 2 - rail!.x - rail!.width / 2);
  }).toBeLessThan(3);
  backend.memories = backend.memories.filter((memory) => memory.id !== MEMORY_IDS[1]);
  backend.emit('memories', 'DELETE', { id: MEMORY_IDS[1] });
  await expect(photo(page, 1)).toHaveCount(0);
  await expect(page.getByText('A refreshed caption, same photograph.')).toBeHidden();
});

test('loading, empty, read failure, and preview retry remain actionable', async ({ page, backend }) => {
  backend.memories = [];
  const release = backend.holdNext('GET', '/rest/v1/spaces');
  await page.goto(timeline);
  await expect(page.getByText(/Gathering your memories/)).toBeVisible();
  release();
  await expect(page.getByRole('button', { name: 'Add the first memory' })).toBeVisible();
  await page.getByRole('button', { name: 'Add the first memory' }).click();
  await expect(page).toHaveURL(`${timeline}/new-memory`);
  backend.failNext('GET', '/rest/v1/spaces', { status: 403, message: 'Fixture membership denied' });
  await page.goto(timeline);
  await expect(page.getByText('This album is unavailable. Ask a member for an invite, or return to your albums.', { exact: true })).toBeVisible();
  await expect(page.getByTestId('memory-photo-rail')).toHaveCount(0);
});

test('reduced motion keeps photo and keyboard interactions immediate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(timeline);
  await photo(page).focus();
  const resting = await photo(page).boundingBox();
  await page.keyboard.down('Space');
  await page.waitForTimeout(200);
  const held = await photo(page).boundingBox();
  // A held keyboard press still gives semantic feedback without moving or
  // compressing the photograph for a reduced-motion user.
  expect(Math.abs(held!.x - resting!.x)).toBeLessThan(0.5);
  expect(Math.abs(held!.y - resting!.y)).toBeLessThan(0.5);
  expect(Math.abs(held!.width - resting!.width)).toBeLessThan(0.5);
  expect(Math.abs(held!.height - resting!.height)).toBeLessThan(0.5);
  await page.keyboard.up('Space');
  await expect(photo(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('A quiet beginning by the sea.')).toBeVisible();
  await photo(page).press('ArrowRight');
  await expect.poll(() => offset(page)).toBeGreaterThan(100);
  await expect(page.getByRole('button', { name: /Hide details for/ })).toHaveCount(0);
});

test('Tab into a neighboring photo closes the previous story without opening another', async ({ page }) => {
  await page.goto(timeline);
  await photo(page).focus();
  await photo(page).press('Enter');
  await expect(photo(page)).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(photo(page, 1)).toBeFocused();
  await expect(page.getByRole('button', { name: /Hide details for/ })).toHaveCount(0);
  await expect(page.getByText('A quiet beginning by the sea.', { exact: true })).toBeHidden();
  await expect.poll(async () => {
    const rail = await page.getByTestId('memory-photo-rail').boundingBox();
    const current = await photo(page, 1).boundingBox();
    return Math.abs(current!.x + current!.width / 2 - rail!.x - rail!.width / 2);
  }).toBeLessThan(3);
});

test('rapid keyboard navigation settles on the requested boundary photo without reopening details', async ({ page }) => {
  await page.goto(timeline);
  await photo(page).focus();
  await photo(page).press('Enter');
  await expect(photo(page)).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('End');
  await page.keyboard.press('Home');
  await page.keyboard.press('End');
  await expect(photo(page, 2)).toBeFocused();
  await expect(page.getByRole('button', { name: /Hide details for/ })).toHaveCount(0);
  await expect.poll(async () => {
    const rail = await page.getByTestId('memory-photo-rail').boundingBox();
    const current = await photo(page, 2).boundingBox();
    return Math.abs(current!.x + current!.width / 2 - rail!.x - rail!.width / 2);
  }).toBeLessThan(3);
  await photo(page, 2).press('Space');
  await expect(page.getByText('The little things matter.', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(photo(page, 2)).toBeFocused();
  await expect(page.getByText('The little things matter.', { exact: true })).toBeHidden();
  await expect(page).toHaveURL(timeline);
});

test('network refresh failure retains the selected photo and can retry', async ({ page, backend }) => {
  await page.goto(timeline);
  await photo(page).click();
  await expect.poll(() => backend.subscribed).toBeGreaterThan(0);
  const restore = backend.failWhile('GET', '/rest/v1/memories', { status: 503, message: 'Fixture refresh unavailable' });
  backend.emit('memories');
  await expect(page.getByText('Fixture refresh unavailable', { exact: true })).toBeVisible();
  await expect(photo(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('A quiet beginning by the sea.', { exact: true })).toBeVisible();
  restore();
  await page.getByRole('button', { name: 'Retry loading memories' }).click();
  await expect(page.getByText('Fixture refresh unavailable', { exact: true })).toBeHidden();
  await expect(photo(page)).toHaveAttribute('aria-expanded', 'true');
});

for (const table of ['spaces', 'memories']) {
  test(`denied ${table} refresh clears private photos, details, and album actions`, async ({ page, backend }) => {
    await page.goto(timeline);
    await photo(page).click();
    await expect.poll(() => backend.subscribed).toBeGreaterThan(0);
    backend.failNext('GET', `/rest/v1/${table}`, { status: 403, message: 'Fixture access revoked', code: '42501' });
    backend.emit(table);
    await expect(page.getByText('This album is unavailable. Ask a member for an invite, or return to your albums.', { exact: true })).toBeVisible();
    await expect(page.getByTestId('memory-photo-rail')).toHaveCount(0);
    await expect(page.getByText('A quiet beginning by the sea.', { exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add a memory', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Create an invite link' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Album options', exact: true })).toHaveCount(0);
  });
}

test('successful leave returns to albums even when a realtime denial clears the timeline before the response', async ({ page, backend }) => {
  await page.goto(timeline);
  await photo(page).click();
  await expect.poll(() => backend.subscribed).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Album options', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Leave space', exact: true }).click();
  const release = backend.holdNext('POST', '/rest/v1/rpc/leave_space');
  await page.getByRole('dialog').getByRole('button', { name: 'Leave', exact: true }).click();
  await expect.poll(() => backend.count('POST', '/rest/v1/rpc/leave_space')).toBe(1);
  // Membership changes can arrive through Realtime before the RPC resolves.
  // Revoked private content must clear immediately, while a successful Leave
  // still completes navigation rather than stranding the user on an error page.
  backend.hasMembership = false;
  backend.emit('memories');
  await expect(page.getByText('This album is unavailable. Ask a member for an invite, or return to your albums.', { exact: true })).toBeVisible();
  await expect(page.getByTestId('memory-photo-rail')).toHaveCount(0);
  release();
  await expect(page).toHaveURL('/spaces');
  await expect(page.getByRole('button', { name: /Create a space/ })).toBeVisible();
  expect(backend.count('POST', '/rest/v1/rpc/leave_space')).toBe(1);
});

test('short-height album dialog keeps close and membership controls reachable with contained keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await page.goto(timeline);
  await page.getByRole('button', { name: 'Show album controls' }).click();
  await page.getByRole('button', { name: 'Album options', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const close = dialog.getByRole('button', { name: 'Close album options' });
  await expect(close).toBeFocused();
  const closeBox = await close.boundingBox();
  expect(closeBox!.y).toBeGreaterThanOrEqual(0);
  expect(closeBox!.y + closeBox!.height).toBeLessThanOrEqual(320);
  for (let index = 0; index < 7; index++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    const box = await page.locator(':focus').boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(320);
  }
  await dialog.getByRole('button', { name: 'Leave space', exact: true }).click();
  await expect(dialog.getByText('Leave this album?', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await close.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Album options', exact: true })).toBeFocused();
});

test('failed photo preview offers a sibling retry without opening memory details', async ({ page, backend }) => {
  backend.failNext('GET', '/storage/v1/object/sign/memory-images/', { status: 503, message: 'Fixture image unavailable' });
  await page.goto(timeline);
  const retry = page.getByRole('button', { name: 'Reload photo for Sunrise together' });
  await expect(retry).toBeVisible();
  const reads = backend.count('GET', '/rest/v1/memories');
  await retry.click();
  await expect.poll(() => backend.count('GET', '/rest/v1/memories')).toBeGreaterThan(reads);
  await expect(retry).toBeHidden();
  await expect(photo(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(page).toHaveURL(timeline);
});
