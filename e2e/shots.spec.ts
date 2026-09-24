import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { obfuscate } from '../scripts/transform.ts';

// Screenshot tour: home, map, game mid-guess (chips), correct reveal,
// level result with stars, daily result, settings — at 360, 768, 1280.

function dailyPuzzle(day: number) {
  return {
    day,
    date: '2026-09-24',
    difficulty: 2,
    chart: {
      d: ['2020-12-01', '2021-01-01', '2021-02-01', '2021-03-01', '2021-04-01', '2021-05-01'],
      v: [100, 120, 900, 400, 500, 650],
      candles: {
        d: ['2020-12-01', '2021-01-01', '2021-02-01', '2021-03-01', '2021-04-01', '2021-05-01'],
        o: [100, 118, 880, 420, 490, 630],
        h: [105, 125, 920, 430, 520, 660],
        l: [95, 110, 860, 390, 480, 620],
        c: [100, 120, 900, 400, 500, 650],
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

const lv = (id: string, n: number, asset: string) => ({
  id,
  world: 1,
  n,
  difficulty: 2,
  chart: {
    d: ['2020-12-01', '2021-01-01', '2021-02-01', '2021-03-01'],
    v: [100, 120, 900, 400],
  },
  hints: ['Video games', '2020–2021', 'USA · Stock'],
  answer: obfuscate(JSON.stringify({ asset, fact: 'Test fact.' }), 'wick-v1' + id),
});

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

async function dismissHowTo(page: Page) {
  for (let i = 0; i < 3; i++) {
    const nx = page.getByRole('button', { name: /^next ›$/i });
    if (await nx.count()) {
      await nx.click();
      continue;
    }
    const pl = page.getByRole('button', { name: /^play$/i });
    if (await pl.count()) {
      await pl.click();
      return;
    }
    return;
  }
}

for (const width of [360, 768, 1280]) {
  test.describe(`tour-${width}`, () => {
    test.use({ viewport: { width, height: 800 } });
    test.beforeEach(async ({ page }) => {
      await page.route('**/puzzles.json', (r) =>
        r.fulfill({
          json: { version: 1, launch: '2026-09-24', puzzles: [dailyPuzzle(1), dailyPuzzle(2)] },
          contentType: 'application/json',
        }),
      );
      await page.route('**/levels/w*.json', (r) => r.abort());
      await page.route('**/levels/w1.json', (r) =>
        r.fulfill({
          json: {
            version: 1,
            world: { id: 1, name: 'Blue Chips', theme: 'Test' },
            levels: [lv('w1-01', 1, 'GameStop'), lv('w1-02', 2, 'Bitcoin')],
          },
          contentType: 'application/json',
        }),
      );
      await page.route('**/cloudflareinsights.com/**', (r) => r.abort());
      await page.route('**/static.cloudflareinsights.com/**', (r) => r.abort());
    });

    test(`screenshots at ${width}`, async ({ page }) => {
      await page.goto('./');
      await dismissHowTo(page);
      await page.waitForTimeout(900); // chart draw-in
      await page.screenshot({ path: `screenshots/${width}-home.png` });
      // daily mid-guess with chips
      await page.getByRole('button', { name: /daily #/i }).click();
      await guess(page, 'Bitcoin');
      await guess(page, 'Ethereum');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `screenshots/${width}-game-mid.png` });
      // daily correct reveal + result
      await guess(page, 'GameStop');
      await expect(page.getByText(/solved in 3/i)).toBeVisible();
      await page.waitForTimeout(1200); // reveal sweep + stars
      await page.locator('section.reveal').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `screenshots/${width}-daily-result.png` });
      // map
      await page.getByRole('button', { name: /wick home/i }).click();
      await page.getByRole('button', { name: /levels/i }).click();
      await page.getByRole('button', { name: 'Level 1', exact: true }).click();
      await guess(page, 'GameStop');
      await expect(page.getByLabel('3 of 3 stars')).toBeVisible();
      await page.waitForTimeout(1200); // star animation
      await page.locator('section.level-result').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `screenshots/${width}-level-result.png` });
      await page.getByRole('button', { name: /wick home/i }).click();
      await page.getByRole('button', { name: /levels/i }).click();
      await expect(page.getByRole('button', { name: /level 1, 3 stars/i })).toBeVisible({ timeout: 8000 });
      await page.screenshot({ path: `screenshots/${width}-map.png` });
      // settings
      await page.getByRole('button', { name: /^settings$/i }).first().click();
      await page.screenshot({ path: `screenshots/${width}-settings.png` });
    });
  });
}
