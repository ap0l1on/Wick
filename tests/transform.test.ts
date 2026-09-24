import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clean, stats, check, downsample, normalize, candles, spoilerViolations, moveHint, yearsHint, obfuscate, deobfuscate, type RawPoint } from '../scripts/transform.ts';

const series = (vals: number[], start = '2021-01-01'): RawPoint[] =>
  vals.map((c, i) => ({ date: new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10), close: c }));

test('pump then dump: rise and drawdown', () => {
  const s = stats(series([10, 8, 5, 20, 50, 100, 60, 30, 10, 5, 4, 3]));
  assert.equal(s.rise.multiple, 20);            // 5 -> 100
  assert.equal(s.rise.from, '2021-01-03');
  assert.ok(Math.abs(s.drawdown.pct - 0.97) < 1e-9); // 100 -> 3
  assert.deepEqual(check(s, { rise: 15, dd: 0.95 }), []);
  assert.equal(check(s, { rise: 25 }).length, 1);
});
test('negative oil', () => {
  const s = stats(series([60, 55, 50, 30, 20, -37, 10, 15, 20, 25]));
  assert.equal(s.wentNegative, true);
  assert.deepEqual(check(s, { neg: true }), []);
  assert.equal(moveHint(s, { neg: true }), 'It went below zero.');
  assert.ok(s.drawdown.pct > 1);
});
test('cliff (one-day drop)', () => {
  const s = stats(series([1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.02, 1.04, 1.05, 1.06]));
  assert.ok(Math.abs(s.cliff.pct - 0.15) < 1e-9);
  assert.equal(s.cliff.date, '2021-01-07');
  assert.deepEqual(check(s, { cliff: 0.1 }), []);
  assert.equal(moveHint(s, { cliff: 0.1 }), '−15% in a single day.');
});
test('clean drops bad rows, sorts, dedupes', () => {
  const raw = [{ date: '2021-01-02', close: 2 }, { date: '2021-01-01', close: 1 }, { date: '2021-01-02', close: 9 }, { date: 'x', close: 3 }, { date: '2021-01-03', close: NaN }] as RawPoint[];
  assert.deepEqual(clean(raw), [{ date: '2021-01-01', close: 1 }, { date: '2021-01-02', close: 2 }]);
});
test('downsample keeps ends and extremes, respects max', () => {
  const vals = Array.from({ length: 1000 }, (_, i) => Math.sin(i / 50) * 10 + 20); vals[437] = 999; vals[811] = -5;
  const d = downsample(series(vals), 120);
  assert.ok(d.length <= 120);
  assert.equal(d[0].date, series(vals)[0].date);
  assert.equal(d[d.length - 1].date, series(vals)[999].date);
  assert.ok(d.some(p => p.close === 999) && d.some(p => p.close === -5));
  for (let i = 1; i < d.length; i++) assert.ok(d[i].date > d[i - 1].date);
});
test('normalize indexes first point to 100', () => {
  assert.deepEqual(normalize(series([4, 8, 1, -2])).v, [100, 200, 25, -50]);
});
test('hints read well', () => {
  const s = stats(series([10, 8, 5, 20, 50, 100, 60, 30, 10, 5, 4, 3]));
  assert.equal(moveHint(s, { rise: 15, dd: 0.95 }), '+1,900% in 3 days, then −97% from the top in 6 days.');
  assert.equal(yearsHint(s), '2021');
});
test('obfuscation round-trips unicode', () => {
  const t = JSON.stringify({ name: 'USD/TRY (Türk lirasi) — 🚀' });
  assert.equal(deobfuscate(obfuscate(t, 'k7'), 'k7'), t);
  assert.ok(!obfuscate(t, 'k7').includes('lirasi'));
});
test('candles bucket OHLC and index to 100', () => {
  const pts = [
    { date: '2021-01-01', close: 10, open: 9, high: 11, low: 8 },
    { date: '2021-01-02', close: 20, open: 10, high: 22, low: 10 },
    { date: '2021-01-03', close: 15, open: 20, high: 21, low: 14 },
    { date: '2021-01-04', close: 30, open: 15, high: 31, low: 15 },
  ];
  const k = candles(pts, 2);
  assert.deepEqual(k.d, ['2021-01-01', '2021-01-03']);
  assert.deepEqual(k.o, [90, 200]);
  assert.deepEqual(k.h, [220, 310]);
  assert.deepEqual(k.l, [80, 140]);
  assert.deepEqual(k.c, [200, 300]);
});
test('candles fall back to closes without OHLC', () => {
  const k = candles(series([10, 20]), 10);
  assert.deepEqual(k.o, [100, 200]);
  assert.deepEqual(k.h, [100, 200]);
  assert.deepEqual(k.l, [100, 200]);
  assert.deepEqual(k.c, [100, 200]);
});
test('spoiler rule catches same-symbol overlap in the window', () => {
  const lv = [{ id: 'w1-01', symbol: 'AAPL', from: '2020-01-01', to: '2020-12-31' }];
  const hit = [{ id: 'day 5', symbol: 'aapl', from: '2020-06-01', to: '2020-09-01', date: '2026-10-01' }];
  assert.equal(spoilerViolations(lv, hit, '2026-09-24').length, 1);
  const past = [{ id: 'day 5', symbol: 'AAPL', from: '2020-06-01', to: '2020-09-01', date: '2026-09-01' }];
  assert.deepEqual(spoilerViolations(lv, past, '2026-09-24'), []);
  const far = [{ id: 'day 5', symbol: 'AAPL', from: '2020-06-01', to: '2020-09-01', date: '2027-06-01' }];
  assert.deepEqual(spoilerViolations(lv, far, '2026-09-24'), []);
  const other = [{ id: 'day 5', symbol: 'MSFT', from: '2020-06-01', to: '2020-09-01', date: '2026-10-01' }];
  assert.deepEqual(spoilerViolations(lv, other, '2026-09-24'), []);
  const adjacent = [{ id: 'day 5', symbol: 'AAPL', from: '2021-01-01', to: '2021-06-01', date: '2026-10-01' }];
  assert.deepEqual(spoilerViolations(lv, adjacent, '2026-09-24'), []);
});
