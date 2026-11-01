import { expect, type Page, test } from '@playwright/test';

async function home(page: Page) {
  await page.goto('./');
  await expect(page.locator('.brand')).toBeVisible();
}

/** Type a visit total on the keypad and enter it, answering any follow-up questions with the first choice or a given one. */
async function visit(page: Page, total: number, answers: number[] = []) {
  for (const ch of String(total)) await page.locator('.keys .key', { hasText: new RegExp(`^${ch}$`) }).click();
  await page.locator('button.enter').click();
  await answer(page, answers);
}

/** Answer the follow-up questions (darts used, darts at a finish) if they appear. */
async function answer(page: Page, answers: number[] = []) {
  for (let i = 0; i < 2; i++) {
    const sheet = page.locator('.sheet .choice-row');
    if (!(await sheet.isVisible().catch(() => false))) {
      await page.waitForTimeout(120);
      if (!(await sheet.isVisible().catch(() => false))) break;
    }
    const want = answers[i];
    const btn = want !== undefined ? sheet.locator('.key', { hasText: new RegExp(`^${want}$`) }) : sheet.locator('.key').first();
    await btn.click();
  }
}

async function resolveCard(page: Page, how: 'Done' | 'Skip') {
  const card = page.locator('.redcard');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: how }).click();
  await expect(card).toBeHidden();
}

test('01 with punishments, resume after reload, stats and history', async ({ page }) => {
  await home(page);
  await page.getByRole('link', { name: /01 game/ }).click();
  await page.getByRole('button', { name: '301' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.board')).toBeVisible();

  await visit(page, 20); // low score → card
  await resolveCard(page, 'Done');
  await visit(page, 180);
  await page.getByRole('button', { name: 'Bust' }).click();
  await answer(page);
  await resolveCard(page, 'Skip');

  await page.reload();
  await expect(page.locator('.seat .led')).toHaveAttribute('aria-label', '101');

  await visit(page, 101, [3]);
  await expect(page.locator('.winner-line')).toBeVisible();
  await page.getByRole('button', { name: 'Home' }).click();

  await page.getByRole('link', { name: 'History' }).click();
  await expect(page.locator('.item', { hasText: '301' }).first()).toContainText('PPR');
  await home(page);
  await page.getByRole('link', { name: 'Stats' }).click();
  await expect(page.locator('.tile', { hasText: 'PPR (3-dart average)' })).toBeVisible();
  await expect(page.locator('.tile', { hasText: 'Cards done' })).toContainText('1');
  await expect(page.locator('.tile', { hasText: 'Cards skipped' })).toContainText('1');
});

test('round limit goes to a cork', async ({ page }) => {
  await home(page);
  await page.getByRole('link', { name: /01 game/ }).click();
  await page.getByRole('button', { name: 'Add player' }).click();
  await page.getByPlaceholder('New player name').fill('Sam');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: /More rules/ }).click();
  await page.getByRole('group', { name: 'Round limit' }).getByRole('button', { name: '10' }).click();
  await page.getByRole('switch').click(); // punishments off
  await page.getByRole('button', { name: 'Start' }).click();
  for (let i = 0; i < 20; i++) await visit(page, 26);
  await expect(page.getByText('Round limit reached')).toBeVisible();
  const panels = page.locator('.sheet .panel');
  await panels.nth(0).getByRole('button', { name: 'Inner' }).click();
  await panels.nth(1).getByRole('button', { name: 'Miss' }).click();
  await page.getByRole('button', { name: /win the cork/ }).click();
  await expect(page.locator('.winner-line')).toHaveText('You win');
});

test('cricket against a bot at your level to the end', async ({ page }) => {
  await home(page);
  await page.getByRole('link', { name: /Cricket/ }).click();
  await page.getByRole('button', { name: 'Add bot' }).click();
  await page.getByRole('button', { name: 'Match my level' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.cgrid')).toBeVisible();
  const plan: [string, string][] = [
    ['t', '20'],
    ['t', '19'],
    ['t', '18'],
    ['t', '17'],
    ['t', '16'],
    ['t', '15'],
    ['d', 'Bull'],
    ['s', 'Bull'],
  ];
  let i = 0;
  for (let guard = 0; guard < 400; guard++) {
    if (await page.locator('.winner-line').isVisible()) break;
    const pad = page.locator('.mults');
    if (!(await pad.isVisible())) {
      await page.waitForTimeout(150);
      continue;
    }
    const [mult, num] = plan[i] ?? ['t', '20'];
    await page.locator(`.mult.${mult}`).click();
    await page.locator('.nums .key', { hasText: new RegExp(`^${num}$`) }).click();
    i++;
  }
  await expect(page.locator('.winner-line')).toBeVisible();
});

test('Count-Up and Catch 40 to the end', async ({ page }) => {
  await home(page);
  await page.goto('./#/new/countup');
  await page.getByRole('button', { name: 'Start' }).click();
  for (const v of [60, 100, 45, 81, 26, 140, 60, 85]) await visit(page, v);
  await expect(page.locator('.winner-line')).toBeVisible();
  await expect(page.locator('.sheet')).toContainText('597');
  await page.getByRole('button', { name: 'Home' }).click();

  await page.goto('./#/new/catch40');
  await page.getByRole('button', { name: 'Start' }).click();
  for (let t = 61; t <= 100; t++) await visit(page, t, [t === 99 ? 3 : 2 + Number(t > 98)]);
  await expect(page.locator('.winner-line')).toBeVisible();
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('link', { name: 'Stats' }).click();
  await page.getByRole('combobox', { name: 'Drill' }).selectOption('catch40');
  await expect(page.locator('.tile', { hasText: 'Best points' })).toBeVisible();
});

test('a timed plan step ends when the clock runs out', async ({ page }) => {
  await page.clock.install();
  await home(page);
  await page.getByRole('link', { name: 'Practice plans' }).click();
  await page.locator('.item', { hasText: 'Finishing school' }).getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: /Start Finish Trainer/ }).click();
  await expect(page.locator('.planbar')).toBeVisible();
  await page.clock.fastForward('10:05');
  await expect(page.locator('.winner-line')).toHaveText('Time is up');
  await page.getByRole('button', { name: 'Back to the plan' }).click();
  await expect(page.getByRole('button', { name: /Next: 121 Checkout/ })).toBeVisible();
});

test('works offline and restores a backup on a fresh device', async ({ page, context, browser }) => {
  await home(page);
  await page.goto('./#/new/countup');
  await page.getByRole('button', { name: 'Start' }).click();
  for (let r = 0; r < 8; r++) await visit(page, 60);
  await expect(page.locator('.winner-line')).toBeVisible();

  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.goto('./');
  await expect(page.locator('.brand')).toBeVisible();
  await context.setOffline(false);

  await page.getByRole('link', { name: 'Settings' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save a backup' }).click()]);
  const file = await download.path();

  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await fresh.newPage();
  await p2.goto('./#/settings');
  await p2.locator('input[type=file]').setInputFiles(file!);
  await expect(p2.getByRole('status')).toContainText('Restored');
  await p2.goto('./#/history');
  await expect(p2.locator('.item', { hasText: 'Count-Up' }).first()).toBeVisible();
  await fresh.close();
});

test('punishments screen is reachable from home and the 01 setup', async ({ page }) => {
  await home(page);
  await page.getByRole('link', { name: /Punishments/ }).click();
  await expect(page.getByRole('heading', { name: 'When cards come up' })).toBeVisible();
  const deck = page.locator('h2 .hint');
  await expect(deck).toHaveText('10 of 10 on');
  await page.getByRole('switch', { name: 'Use N push-ups' }).click();
  await expect(deck).toHaveText('9 of 10 on');
  const under30 = page.getByRole('group', { name: 'Low-score visit' }).getByRole('button', { name: 'Under 30' });
  await under30.click();
  await expect(under30).toHaveAttribute('aria-pressed', 'true'); // saved before we leave the page

  await home(page);
  await page.getByRole('link', { name: /01 game/ }).click();
  await expect(page.locator('.panel', { hasText: 'Punishments' })).toContainText('visits under 30');
  await page.getByRole('link', { name: 'Change cards and triggers' }).click();
  await expect(page.locator('h2 .hint')).toHaveText('9 of 10 on');
});
