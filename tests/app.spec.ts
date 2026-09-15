import { expect, test, type Page } from '@playwright/test';

const instagramRule = {
  id: 'instagram-daily',
  name: '10 Unblock Daily',
  enabled: true,
  mode: 'blocklist',
  siteIds: ['instagram'],
  packageNames: [],
  domains: [],
  recurrence: 'always',
  days: [],
  difficulty: 'easy',
  unblocksPerDay: 10,
  presetIcon: 'lock',
};

async function openAppsWithRule(page: Page) {
  await page.goto('/#/apps');
  await page.evaluate((rule) => {
    const key = 'amethyst.state';
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error('Expected Amethyst state to be initialized.');
    const state = JSON.parse(raw);
    state.rules = [rule];
    localStorage.setItem(key, JSON.stringify(state));
  }, instagramRule);
  await page.reload();
}

async function waitForOwnAnimations(page: Page) {
  await page.getByRole('dialog').evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
}

test('home uses the audited three-tab cave layout and scrolls to its cards', async ({ page }) => {
  await page.goto('/#/home');

  await expect(page.getByText('Amethyst', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Open Amethyst Score(?:: \d+)?/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My apps' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Timer' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Profile' })).toHaveCount(0);

  await page.getByText('First step taken').scrollIntoViewIfNeeded();
  await expect(page.getByText('First step taken')).toBeVisible();
  await expect(page.locator('.home-my-apps')).toHaveCount(0);
  await expect(page.locator('.home-live__brand img')).toHaveCount(0);

  await page.getByRole('link', { name: 'Timer' }).click();
  await expect(page.getByRole('heading', { name: 'Timer' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('home keeps the prominent gem hierarchy at phone size', async ({ page }) => {
  await page.goto('/#/home');

  const [stone, score, metric, tabbar] = await Promise.all([
    page.locator('.home-stone img').boundingBox(),
    page.locator('.home-arc strong').boundingBox(),
    page.locator('.home-score-pills button').first().boundingBox(),
    page.locator('.tabbar').boundingBox(),
  ]);

  expect(stone).not.toBeNull();
  expect(score).not.toBeNull();
  expect(metric).not.toBeNull();
  expect(tabbar).not.toBeNull();
  expect(stone!.width).toBeGreaterThanOrEqual(340);
  expect(stone!.width).toBeLessThanOrEqual(370);
  expect(score!.height).toBeLessThanOrEqual(60);
  expect(metric!.height).toBeLessThanOrEqual(64);
  expect(tabbar!.height).toBeLessThanOrEqual(82);
});

test('Apps exposes schedules, blocked apps, and the schedule editor', async ({ page }) => {
  await openAppsWithRule(page);

  await expect(page.getByRole('heading', { name: 'Apps' }).first()).toBeVisible();
  await expect(page.getByText('Blocked apps')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Schedules' })).toBeVisible();
  await expect(page.locator('.app-group-list')).toHaveCount(0);

  await page.getByRole('button', { name: 'See all schedules' }).click();
  await page.getByRole('button', { name: 'Create a schedule', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New Block' })).toBeVisible();
  await waitForOwnAnimations(page);
  const box = await dialog.boundingBox();
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight);
  expect(box!.y).toBeLessThan(80);
  expect(box!.height).toBeGreaterThan(viewportHeight * 0.85);
  await expect(page.locator('body')).toHaveAttribute('data-modal-open', 'true');
});

test('rule details open as a near-full-screen device sheet', async ({ page }) => {
  await openAppsWithRule(page);

  await page.locator('.amethyst-rule-tile').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await waitForOwnAnimations(page);
  const box = await dialog.boundingBox();
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThan(80);
  expect(box!.height).toBeGreaterThan(viewportHeight * 0.85);
});

test('Android Back event dismisses the active sheet without leaving the app', async ({ page }) => {
  await openAppsWithRule(page);
  await page.locator('.amethyst-rule-tile').first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-modal-open', 'true');

  await page.evaluate(() => window.dispatchEvent(new Event('amethyst-back-button')));

  await expect(dialog).toBeHidden();
  await expect(page.locator('body')).not.toHaveAttribute('data-modal-open', 'true');
  await expect(page).toHaveURL(/#\/apps$/);
});

test('Timer opens the hold-to-start sheet and has no Digital Detox presets', async ({ page }) => {
  await page.goto('/#/timer');

  await expect(page.getByRole('heading', { name: 'Timer' })).toBeVisible();
  await expect(page.getByText('AMETHYST', { exact: true })).toHaveCount(0);
  await expect(page.getByText('30m', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle app blocking' })).toContainText('Block');
  await expect(page.getByRole('button', { name: 'Toggle app blocking' })).toContainText('No');
  await expect(page.getByText('Digital detox')).toHaveCount(0);
  await expect(page.locator('.timer-detox-grid')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start focus session' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByText('Hold to start')).toBeVisible();
  await waitForOwnAnimations(page);
  const box = await dialog.boundingBox();
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight);
});

test('Timer keeps the reference composition inside a phone viewport', async ({ page }) => {
  await page.goto('/#/timer');

  const timer = page.locator('.timer-cave__ring-wrap');
  const duration = page.locator('.timer-duration');
  const start = page.getByRole('button', { name: 'Start focus session' });
  const block = page.getByRole('button', { name: 'Toggle app blocking' });
  const firstPreset = page.locator('.timer-preset-card').first();

  const [timerBox, durationBox, startBox, blockBox, presetBox] = await Promise.all([
    timer.boundingBox(),
    duration.boundingBox(),
    start.boundingBox(),
    block.boundingBox(),
    firstPreset.boundingBox(),
  ]);

  expect(timerBox).not.toBeNull();
  expect(durationBox).not.toBeNull();
  expect(startBox).not.toBeNull();
  expect(blockBox).not.toBeNull();
  expect(presetBox).not.toBeNull();
  expect(timerBox!.y).toBeLessThan(durationBox!.y);
  expect(durationBox!.y).toBeLessThan(startBox!.y);
  expect(startBox!.y).toBeLessThan(blockBox!.y);
  expect(blockBox!.y).toBeLessThan(presetBox!.y);
  expect(startBox!.width).toBeGreaterThan(330);
  expect(blockBox!.width).toBeLessThan(startBox!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('Score and Settings deep links render local-only screens', async ({ page }) => {
  await page.goto('/#/score');
  await expect(page.getByText('What is Amethyst Score?')).toBeVisible();
  await page.getByText('App unblocks').scrollIntoViewIfNeeded();
  await expect(page.getByText('App unblocks')).toBeVisible();

  await page.goto('/#/settings');
  await expect(page.getByText('Stored locally')).toBeVisible();
  await expect(page.getByRole('button', { name: /Export data/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Reset Amethyst/ })).toBeVisible();
  await expect(page.getByText(/subscription|purchase|referral|community/i)).toHaveCount(0);

  await page.getByRole('button', { name: /Permissions/ }).click();
  await expect(page.getByRole('heading', { name: 'Permissions' })).toBeVisible();
  await expect(page.getByText('Browser blocking')).toHaveCount(0);
});

test('Score matches the compact gauge hierarchy and hold isolation is temporary', async ({ page }) => {
  await page.goto('/#/score');

  const gauge = page.locator('.score-live__arc');
  const sleep = page.getByRole('button', { name: /sleep/i });
  const focus = page.getByRole('button', { name: /focus/i });
  const firstDimension = page.locator('.score-live__pills > button').first();
  const intro = page.locator('.score-live__intro');

  const [gaugeBox, dimensionBox] = await Promise.all([
    gauge.boundingBox(),
    firstDimension.boundingBox(),
  ]);
  expect(gaugeBox).not.toBeNull();
  expect(dimensionBox).not.toBeNull();
  expect(gaugeBox!.height).toBeLessThanOrEqual(170);
  expect(dimensionBox!.height).toBeLessThanOrEqual(62);
  await expect(intro).toHaveCSS('border-top-width', '0px');

  await focus.click();
  await expect(focus).toHaveAttribute('aria-pressed', 'true');
  const sleepBox = await sleep.boundingBox();
  expect(sleepBox).not.toBeNull();
  await page.mouse.move(sleepBox!.x + sleepBox!.width / 2, sleepBox!.y + sleepBox!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await expect(sleep).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.up();
  await expect(focus).toHaveAttribute('aria-pressed', 'true');
  await expect(sleep).toHaveAttribute('aria-pressed', 'false');
});

test('focus outlines follow input modality: hidden after tap, visible after Tab', async ({ page }) => {
  await page.goto('/#/home');

  const homeLink = page.getByRole('link', { name: 'Home' });
  await homeLink.tap();
  await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'pointer');
  const tappedOutlineWidth = await homeLink.evaluate((node) => getComputedStyle(node).outlineWidth);
  expect(tappedOutlineWidth).toBe('0px');

  await page.keyboard.press('Tab');
  await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'keyboard');
  await expect(page.locator(':focus')).toHaveCSS('outline-style', 'solid');
});
