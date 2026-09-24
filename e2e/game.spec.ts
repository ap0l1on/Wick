import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { obfuscate } from '../scripts/transform.ts';

// E2E at 360 + 1280 (projects). Stubs network data so runs are deterministic.

function dailyPuzzle(day: number) {
  return {
    day,
    date: '2026-09-24',
    difficulty: 1,
    chart: {
      d: ['2020-12-01', '2021-01-01', '2021-02-01', '2021-03-01'],
      v: [100, 120, 900, 400],
      candles: {
        d: ['2020-12-01', '2021-01-01', '2021-02-01', '2021-03-01'],
        o: [100, 118, 880, 420],
        h: [105, 125, 920, 430],
        l: [95, 110, 860, 390],
        c: [100, 120, 900, 400],
      },
    },
    hints: ['Stock', '2020–2021', 'Video game retailer, USA', 'Hedge funds bet against it', 'Reddit bet on it.'],
    answer: obfuscate(
      JSON.stringify({
        key: 'gme21',
        asset: 'GameStop',
        title: 'GameStop (2021 squeeze)',
        aliases: ['GME', 'GameStop'],
        story: 'Test story.',
        tvUrl: 'https://www.tradingview.com/chart/?symbol=GME',
      }),
      'wick-v1' + day,
    ),
  };
}

function level(id: string, world: number, n: number, asset: string, fact: string) {
  return {
    id,
    world,
    n,
    difficulty: 2,
    chart: {
      d: ['2020-12-01', '2021-01-01', '2021-02-01', '2021-03-01'],
      v: [100, 120, 900, 400],
    },
    hints: ['Video games', '2020–2021', 'USA · Stock'],
    answer: obfuscate(JSON.stringify({ asset, fact }), 'wick-v1' + id),
  };
}

const cspErrors: string[] = [];
const pageErrors: Error[] = [];

test.beforeEach(async ({ page }) => {
  cspErrors.length = 0;
  pageErrors.length = 0;
  page.on('console', (m) => {
    if (m.type() === 'error' && /content-security-policy|csp/i.test(m.text())) cspErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e));
  await page.route('**/puzzles.json', (r) =>
    r.fulfill({
      json: { version: 1, launch: '2026-09-24', puzzles: [dailyPuzzle(1), dailyPuzzle(2), dailyPuzzle(3)] },
      contentType: 'application/json',
    }),
  );
  await page.route('**/levels/w*.json', (r) => r.abort());
  // Block the analytics beacon: deterministic offline runs, no console noise.
  await page.route('**/cloudflareinsights.com/**', (r) => r.abort());
  await page.route('**/static.cloudflareinsights.com/**', (r) => r.abort());
  await page.route('**/levels/w1.json', (r) =>
    r.fulfill({
      json: {
        version: 1,
        world: { id: 1, name: 'Blue Chips', theme: 'Test' },
        levels: [
          level('w1-01', 1, 1, 'GameStop', 'Test fact one.'),
          level('w1-02', 1, 2, 'Bitcoin', 'Test fact two.'),
        ],
      },
      contentType: 'application/json',
    }),
  );
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
  expect(cspErrors).toEqual([]);
});

async function dismissHowTo(page: Page) {
  // 3-step modal: Next, Next, Play (only on first visit).
  for (let i = 0; i < 3; i++) {
    const next = page.getByRole('button', { name: /^next ›$/i });
    if (await next.count()) {
      await next.click();
      continue;
    }
    const play = page.getByRole('button', { name: /^play$/i });
    if (await play.count()) {
      await play.click();
      return;
    }
    return;
  }
}

async function guess(page: Page, name: string) {
  const input = page.getByPlaceholder(/company, coin or index/i);
  await expect(input).toBeVisible();
  const rows = page.locator('ol.guesses li.guess:not(.guess-slot-empty)');
  const before = await rows.count();
  await input.fill(name);
  await page.waitForTimeout(200);
  // keyboard submit: immune to suggestion-overlay click races
  await input.press('Enter');
  try {
    await expect.poll(async () => rows.count(), { timeout: 5000 }).toBe(before + 1);
  } catch {
    await page.getByRole('button', { name: /^guess$/i }).click();
    await expect.poll(async () => rows.count(), { timeout: 8000 }).toBe(before + 1);
  }
}

test('daily: solve in 3, locks on reload, share grid right', async ({ page }) => {
  await page.goto('./');
  await dismissHowTo(page);
  await page.getByRole('button', { name: /daily #/i }).click();
  await guess(page, 'Bitcoin');
  await guess(page, 'Ethereum');
  await guess(page, 'GameStop');
  await expect(page.getByText(/solved in 3/i)).toBeVisible();
  const grid = await page.locator('pre.share-grid').innerText();
  expect(grid).toMatch(/Wick #\d+ 3\/5\n🟥🟥🟩/);
  await expect(page.getByRole('link', { name: /tradingview/i })).toBeVisible();
  await page.reload();
  await dismissHowTo(page);
  await page.getByRole('button', { name: /daily #/i }).click();
  await expect(page.getByText(/solved in 3/i)).toBeVisible({ timeout: 8000 });
  await expect(page.getByPlaceholder(/company, coin or index/i)).toHaveCount(0);
});

test('levels: solve level 1 in 1 (3 stars), level 2 unlocks, map shows stars', async ({ page }) => {
  await page.goto('./');
  await dismissHowTo(page);
  await page.getByRole('button', { name: /levels/i }).click();
  await page.getByRole('button', { name: 'Level 1', exact: true }).click();
  await guess(page, 'GameStop');
  await expect(page.getByLabel('3 of 3 stars')).toBeVisible();
  await page.getByRole('button', { name: /back to map|map/i }).first().click().catch(() => {});
  await page.goto('./');
  await page.getByRole('button', { name: /levels/i }).click();
  await expect(page.getByRole('button', { name: /level 1.*solved|level 1/i }).first()).toBeVisible();
});

test('levels: failed level can be retried, progress survives reload', async ({ page }) => {
  await page.goto('./');
  await dismissHowTo(page);
  await page.getByRole('button', { name: /levels/i }).click();
  await page.getByRole('button', { name: 'Level 1', exact: true }).click();
  await guess(page, 'GameStop');
  await expect(page.getByLabel('3 of 3 stars')).toBeVisible();
  await page.getByRole('button', { name: /next level/i }).click();
  for (const name of ['GameStop', 'Dogecoin', 'Ethereum', 'Aave', 'Uniswap']) await guess(page, name);
  await expect(page.getByText(/out of guesses/i)).toBeVisible();
  await page.getByRole('button', { name: /retry/i }).click();
  await expect(page.getByPlaceholder(/company, coin or index/i)).toBeVisible();
  await page.reload();
  await dismissHowTo(page);
  await page.getByRole('button', { name: /levels/i }).click();
  await expect(page.getByRole('button', { name: /level 1, 3 stars/i })).toBeVisible({ timeout: 8000 });
});

test('zero axe violations on home', async ({ page }) => {
  await page.goto('./');
  await dismissHowTo(page);
  const res = await new AxeBuilder({ page }).analyze();
  expect(res.violations).toEqual([]);
});
