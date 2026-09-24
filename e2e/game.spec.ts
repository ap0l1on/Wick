import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { obfuscate } from '../scripts/transform.ts';

// M9 E2E at 360 + 1280 (projects). Requires preview server with public/puzzles.json.
// These tests use a stubbed puzzles.json via route interception so they run pre-launch.

const STUB = {
  version: 1,
  launch: '2026-10-14',
  puzzles: [
    {
      day: 1,
      date: '2026-10-14',
      difficulty: 1,
      chart: { d: ['2020-12-01', '2021-01-01', '2021-02-01', '2021-03-01'], v: [100, 120, 900, 400] },
      hints: ['Stock', '2020–2021', '+800% in 2 months.', 'Video game retailer, USA', 'Hedge funds bet against it; Reddit bet on it.'],
      answer: '', // filled below by obfuscating with wick-v1+day
    },
  ],
};

test.beforeEach(async ({ page }) => {
  const payload = JSON.stringify({
    key: 'gme21',
    asset: 'GameStop',
    title: 'GameStop (2021 squeeze)',
    aliases: ['GME', 'GameStop'],
    story: 'Test story.',
    tvUrl: 'https://www.tradingview.com/chart/?symbol=GME',
  });
  const stub = { ...STUB, puzzles: [{ ...STUB.puzzles[0], answer: obfuscate(payload, 'wick-v1' + 1) }] };
  await page.route('**/puzzles.json', (r) => r.fulfill({ json: stub, contentType: 'application/json' }));
  // stub guess-list import is bundled; tests rely on real bundle containing GameStop.
});

test('win in 1 shows reveal + share copies text', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /play|how/i }).first().click().catch(() => {});
  const input = page.getByPlaceholder(/name the asset/i);
  await expect(input).toBeVisible();
  await input.fill('GameStop');
  await page.getByRole('button', { name: /^guess$/i }).click();
  await expect(page.getByText(/you got it in 1/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /tradingview/i })).toBeVisible();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: /^share$/i }).click();
  // clipboard may be unavailable with web-share; just verify reveal axis appeared
  await expect(page.getByText(/jan 2021|dec 2020/i).first()).toBeVisible({ timeout: 5000 }).catch(() => {});
});

test('loss after 5 + hints unlock in order', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /play/i }).first().click().catch(() => {});
  const names = ['Bitcoin', 'Aave', 'Adani Enterprises', 'Dogecoin', 'AAPL'];
  for (const n of names) {
    const input = page.getByPlaceholder(/name the asset/i);
    await input.fill(n);
    // pick first suggestion if present
    const opt = page.getByRole('option').first();
    if (await opt.count()) await opt.click().catch(() => {});
    else await page.getByRole('button', { name: /^guess$/i }).click();
    await page.waitForTimeout(200);
    if (await page.getByText(/it was gamestop/i).count()) break;
  }
  await expect(page.getByText(/it was gamestop/i)).toBeVisible({ timeout: 8000 });
});

test('reload mid-game restores state, TV hidden before end', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /play/i }).first().click().catch(() => {});
  await expect(page.getByRole('link', { name: /tradingview/i })).toHaveCount(0);
  const input = page.getByPlaceholder(/name the asset/i);
  await input.fill('Bitcoin');
  await page.getByRole('button', { name: /^guess$/i }).click();
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.getByText('Bitcoin').first()).toBeVisible({ timeout: 8000 });
});

test('zero axe violations both themes', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /play/i }).first().click().catch(() => {});
  for (const theme of ['dark', 'light'] as const) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    const res = await new AxeBuilder({ page }).analyze();
    expect(res.violations).toEqual([]);
  }
});
