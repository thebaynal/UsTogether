import type { Page } from '@playwright/test';
import { test, expect, SPACE_ID } from '../fixtures/backend';

test.use({ signedIn: false });
async function credentials(page: Page) {
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('fixture@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
}
const card = (page: Page, index: number) => page.getByRole('button', { name: `Show ${['Your people.', 'Your moments.', 'Your story.'][index]} card` });

test('private direct links redirect to sign-in; validation and rejected credentials remain actionable', async ({ page, backend }) => {
  await page.goto(`/spaces/${SPACE_ID}`);
  await expect(page).toHaveURL('/sign-in');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Use a password with at least 8 characters.')).toBeVisible();
  expect(backend.count('POST', '/auth/v1/token')).toBe(0);
  backend.authRejected = true;
  await credentials(page);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Invalid login credentials', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue('fixture@example.invalid');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
});

test('account creation preserves confirmation-required behavior', async ({ page, backend }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: /New around here/ }).click();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('Add a name your friends will recognize.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Your name', exact: true }).fill('Fixture Friend');
  await credentials(page);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText(/Your account was created.*confirm your email/)).toBeVisible();
  expect(backend.count('POST', '/auth/v1/signup')).toBe(1);
  await expect(page).toHaveURL('/sign-in');
});

test('invitation token survives login and is accepted once before opening the album', async ({ page, backend }) => {
  await page.goto('/invite/synthetic-invite-token');
  await expect(page).toHaveURL('/sign-in?inviteToken=synthetic-invite-token');
  await credentials(page);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(`/spaces/${SPACE_ID}`);
  await expect(page.getByRole('button', { name: 'Show details for Sunrise together' })).toBeVisible();
  expect(backend.count('POST', '/rest/v1/rpc/accept_space_invite')).toBe(1);
  expect(backend.requests.find((request) => request.path === '/rest/v1/rpc/accept_space_invite')?.body).toEqual({ p_token: 'synthetic-invite-token' });
});

test('flashcards pause for form focus, loop boundaries, and retain values without announcements', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-09T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-09T12:00:01Z'));
  await page.goto('/sign-in');
  await page.clock.runFor(500);
  await expect(card(page, 0)).toHaveAttribute('aria-pressed', 'true');
  const email = page.getByRole('textbox', { name: 'Email', exact: true });
  await email.fill('kept@example.invalid');
  await page.clock.runFor(9000);
  await expect(card(page, 0)).toHaveAttribute('aria-pressed', 'true');
  await expect(email).toBeFocused();
  await expect(email).toHaveValue('kept@example.invalid');
  await expect(page.getByTestId('romantic-flashcards')).not.toHaveAttribute('aria-live', /polite|assertive/);
  await page.locator('body').click({ position: { x: 3, y: 3 } });
  await page.mouse.move(0, 0);
  const advance = async (index: number) => {
    await page.clock.runFor(4000);
    await expect.poll(async () => { await page.clock.runFor(200); return card(page, index).getAttribute('aria-pressed'); }).toBe('true');
  };
  await advance(1);
  await advance(2);
  await advance(0);
  await expect(email).toHaveValue('kept@example.invalid');
  await expect(page.getByRole('heading', { name: 'Your people.', exact: true })).toHaveCount(1);
  await card(page, 2).click();
  await expect.poll(async () => { await page.clock.runFor(200); return card(page, 2).getAttribute('aria-pressed'); }).toBe('true');
  await page.getByRole('button', { name: 'Pause flashcards' }).click();
  await page.locator('body').click({ position: { x: 3, y: 3 } });
  await page.clock.runFor(9000);
  await expect(card(page, 2)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Play flashcards' }).click();
  await page.locator('body').click({ position: { x: 3, y: 3 } });
  await page.mouse.move(0, 0);
  await advance(0);
});

test('flashcard inactivity and submission pauses restart cleanly', async ({ page, backend }) => {
  await page.clock.install({ time: new Date('2026-10-09T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-09T12:00:01Z'));
  await page.goto('/sign-in');
  await page.clock.runFor(500);
  // This exercises the web visibility handler; it is not an OS background test.
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.runFor(9000);
  await expect(card(page, 0)).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await credentials(page);
  const release = backend.holdNext('POST', '/auth/v1/token');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.mouse.move(0, 0);
  await page.clock.runFor(9000);
  await expect(card(page, 0)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveAttribute('aria-disabled', 'true');
  release();
  await expect(page).toHaveURL('/spaces');
  await page.clock.runFor(9000);
  await expect(page.getByTestId('romantic-flashcards')).toBeHidden();
});

test('manual flashcard swipes cross the backward boundary and preserve form values while paused', async ({ page, context }, testInfo) => {
  await page.goto('/sign-in');
  const email = page.getByRole('textbox', { name: 'Email', exact: true });
  await email.fill('kept@example.invalid');
  await page.getByRole('button', { name: 'Pause flashcards' }).click();
  const strip = page.getByTestId('romantic-flashcards-scroll');
  const swipe = async (direction: 'next' | 'previous') => {
    const box = await strip.boundingBox();
    expect(box).not.toBeNull();
    if (testInfo.project.name.includes('mobile')) {
      const cdp = await context.newCDPSession(page);
      const y = box!.y + box!.height / 2;
      const start = box!.x + box!.width * (direction === 'next' ? 0.8 : 0.2);
      const delta = box!.width * 0.65 * (direction === 'next' ? -1 : 1);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] });
      for (let index = 1; index <= 8; index++) {
        await page.waitForTimeout(30);
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{ x: start + delta * index / 8, y }]
        });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      await strip.hover();
      await page.mouse.wheel(box!.width * 0.75 * (direction === 'next' ? 1 : -1), 0);
    }
  };
  await swipe('next');
  await expect(card(page, 1)).toHaveAttribute('aria-pressed', 'true');
  await expect(email).toHaveValue('kept@example.invalid');
  await card(page, 0).click();
  await expect(card(page, 0)).toHaveAttribute('aria-pressed', 'true');
  await swipe('previous');
  await expect(card(page, 2)).toHaveAttribute('aria-pressed', 'true');
  // A backward swipe through the boundary copy returns to the real final card,
  // leaving room to swipe in both directions rather than getting stuck at zero.
  await expect.poll(() => strip.evaluate((element) => element.scrollLeft / element.clientWidth)).toBeGreaterThan(2);
  await expect(page.getByRole('heading', { name: 'Your story.', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Play flashcards' })).toBeVisible();
  await expect(email).toHaveValue('kept@example.invalid');
  await expect(page).toHaveURL('/sign-in');
  const play = page.getByRole('button', { name: 'Play flashcards' });
  if (testInfo.project.name.includes('mobile')) {
    await play.tap();
    await page.locator('body').tap({ position: { x: 3, y: 3 } });
  } else {
    await play.click();
    await page.locator('body').click({ position: { x: 3, y: 3 } });
  }
  // Resume after real interaction, without mouse.move clearing sticky touch
  // hover for us. The next advance starts a fresh four-second countdown.
  await page.waitForTimeout(1000);
  await expect(card(page, 2)).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page, 0)).toHaveAttribute('aria-pressed', 'true', { timeout: 6500 });
  await expect(email).toHaveValue('kept@example.invalid');
});

test('flashcard boundary stays under a held finger and normalizes only after release', async ({ page, context }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'Held-finger regression uses the mobile touch profile.');
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Pause flashcards' }).click();
  const strip = page.getByTestId('romantic-flashcards-scroll');
  const box = await strip.boundingBox();
  expect(box).not.toBeNull();
  const cdp = await context.newCDPSession(page);
  const y = box!.y + box!.height / 2;
  const start = box!.x + box!.width * 0.12;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] });
  for (let index = 1; index <= 8; index++) {
    await page.waitForTimeout(30);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: start + box!.width * 0.82 * index / 8, y }]
    });
  }
  await page.waitForTimeout(50);
  const heldPosition = await strip.evaluate((element) => element.scrollLeft);
  await page.waitForTimeout(600);
  const afterHold = await strip.evaluate((element) => element.scrollLeft);
  // Still touching the backward copy: normalization may not yank the rail to
  // its distant duplicate while the user is directly controlling the content.
  expect(Math.abs(afterHold - heldPosition)).toBeLessThan(4);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await expect(card(page, 2)).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => strip.evaluate((element) => element.scrollLeft / element.clientWidth)).toBeGreaterThan(2);
  await expect(page.getByRole('button', { name: 'Play flashcards' })).toBeVisible();
  await expect(page).toHaveURL('/sign-in');
});

test('reduced-motion flashcards stay manual with working pagination', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-09T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-09T12:00:01Z'));
  await page.goto('/sign-in');
  await page.clock.runFor(500);
  await expect(page.getByRole('button', { name: 'Automatic scrolling disabled for reduced motion' })).toBeDisabled();
  await page.mouse.move(0, 0);
  await page.clock.runFor(9000);
  await expect(card(page, 0)).toHaveAttribute('aria-pressed', 'true');
  await card(page, 1).click();
  await expect(card(page, 1)).toHaveAttribute('aria-pressed', 'true');
});
