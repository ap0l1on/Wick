import { describe, it, expect } from 'vitest';
import { dayIndex, dayState, LAUNCH_UTC, DAY_MS } from '../src/lib/day.ts';
import { buildLookup, matchGuess, suggest, tileFor, isCorrectAsset, type GuessEntry } from '../src/lib/guess.ts';
import { store } from '../src/lib/storage.ts';
import { shareText, siteDomain } from '../src/lib/share.ts';

const list: GuessEntry[] = [
  { name: 'GameStop', aliases: ['GME'], class: 'stock' },
  { name: 'Bitcoin', aliases: ['BTC', 'XBT'], class: 'crypto' },
  { name: 'Türk Lirası', aliases: ['TRY', 'lira', 'türk lirası'], class: 'currency' },
  { name: 'Dogecoin', aliases: ['DOGE', 'doge'], class: 'crypto' },
];

describe('day index (M2.1, M9)', () => {
  it('day 1 starts at launch midnight UTC', () => {
    expect(dayIndex(LAUNCH_UTC)).toBe(1);
    expect(dayIndex(LAUNCH_UTC + DAY_MS - 1)).toBe(1);
    expect(dayIndex(LAUNCH_UTC + DAY_MS)).toBe(2);
  });
  it('23:59:59 vs 00:00:00 boundary', () => {
    const d1end = LAUNCH_UTC + DAY_MS - 1000;
    expect(dayState(d1end).day).toBe(1);
    expect(dayState(LAUNCH_UTC + DAY_MS).day).toBe(2);
  });
  it('day 0 pre-launch and day 101 post', () => {
    expect(dayState(LAUNCH_UTC - 1).kind).toBe('pre');
    expect(dayState(LAUNCH_UTC - 1).day).toBe(0);
    expect(dayState(LAUNCH_UTC + 100 * DAY_MS).kind).toBe('post');
    expect(dayState(LAUNCH_UTC + 100 * DAY_MS).day).toBe(101);
  });
});

describe('guess matching (M2.2)', () => {
  const lookup = buildLookup(list);
  it('aliases, case, accents', () => {
    expect(matchGuess('gme', lookup)?.name).toBe('GameStop');
    expect(matchGuess('GME', lookup)?.name).toBe('GameStop');
    expect(matchGuess('doge', lookup)?.name).toBe('Dogecoin');
    expect(matchGuess('lira', lookup)?.name).toBe('Türk Lirası');
    expect(matchGuess('TÜRK LİRASI', lookup)?.name).toBe('Türk Lirası');
  });
  it('free text rejected', () => {
    expect(matchGuess('GameStop Inc random', lookup)).toBeNull();
    expect(matchGuess('', lookup)).toBeNull();
  });
  it('suggest up to 6', () => {
    expect(suggest('g', list).length).toBeLessThanOrEqual(6);
  });
  it('asset-level correctness (Bitcoin right for both BTC puzzles)', () => {
    expect(isCorrectAsset({ name: 'Bitcoin', aliases: [], class: 'crypto' }, 'Bitcoin', ['BTC'])).toBe(true);
    expect(isCorrectAsset({ name: 'BTC', aliases: [], class: 'crypto' }, 'Bitcoin', ['BTC'])).toBe(false); // entry names canonical
  });
});

describe('tiles (M2.3)', () => {
  it('right / near / wrong', () => {
    expect(tileFor('stock', 'GameStop', 'GameStop', 'stock')).toBe('right');
    expect(tileFor('crypto', 'Bitcoin', 'Dogecoin', 'crypto')).toBe('near');
    expect(tileFor('stock', 'Bitcoin', 'GameStop', 'crypto')).toBe('wrong');
  });
});

describe('streak across skipped day (M2.6)', () => {
  it('breaks on skipped day', () => {
    let s = store.applyResult({ played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0], lastDay: 0 }, 5, true, 2);
    expect(s.streak).toBe(1);
    s = store.applyResult(s, 7, true, 2); // skipped day 6
    expect(s.streak).toBe(1);
  });
  it('loss breaks streak', () => {
    let s = store.applyResult({ played: 1, wins: 1, streak: 2, maxStreak: 2, dist: [1, 0, 0, 0, 0, 0], lastDay: 5 }, 6, false, 5);
    expect(s.streak).toBe(0);
  });
});

describe('share text (M2.7 exact)', () => {
  it('win format', () => {
    expect(shareText(12, ['wrong', 'near', 'right'], true, 'https://example.com/wick')).toBe(
      'Wick #12 3/5\n🟥🟨🟩\nhttps://example.com/wick',
    );
  });
  it('loss shows X/5', () => {
    expect(shareText(12, ['wrong', 'wrong', 'wrong', 'wrong', 'wrong'], false, 'https://example.com/wick')).toBe(
      'Wick #12 X/5\n🟥🟥🟥🟥🟥\nhttps://example.com/wick',
    );
  });
  it('never contains answer', () => {
    const t = shareText(1, ['right'], true, 'https://example.com/wick');
    expect(t).not.toContain('GameStop');
  });
  it('site is never hard-coded (host + path, no scheme)', () => {
    // Node has no window: falls back to a scheme-less placeholder.
    expect(siteDomain()).not.toContain('https://');
  });
});
