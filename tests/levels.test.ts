import { describe, it, expect } from 'vitest';
import {
  starsForSolve, worldStars, totalStars, isWorldUnlocked, isLevelUnlocked,
  nextLevel, currentLevel, type LevelDef, STARS_TO_UNLOCK_WORLD, TOTAL_STARS,
} from '../src/lib/levels.ts';
import {
  emptyProgress, parseProgress, loadProgress, recordLevel,
  exportProgress, importProgress,
} from '../src/lib/progress.ts';
import { feedbackChips, flag, metaFor } from '../src/lib/chips.ts';
import { shareLevelText, starString, levelNumber } from '../src/lib/share.ts';

// 2 worlds × 3 levels fixture (same rules as 6×20).
const defs: LevelDef[] = [
  { id: 'w1-01', world: 1, n: 1 }, { id: 'w1-02', world: 1, n: 2 }, { id: 'w1-03', world: 1, n: 3 },
  { id: 'w2-01', world: 2, n: 1 }, { id: 'w2-02', world: 2, n: 2 }, { id: 'w2-03', world: 2, n: 3 },
];

describe('stars', () => {
  it('3 for 1-2 guesses, 2 for 3-4, 1 for 5', () => {
    expect(starsForSolve(1, 0)).toBe(3);
    expect(starsForSolve(2, 0)).toBe(3);
    expect(starsForSolve(3, 0)).toBe(2);
    expect(starsForSolve(4, 0)).toBe(2);
    expect(starsForSolve(5, 0)).toBe(1);
  });
  it('each hint caps one star fewer, never below 1', () => {
    expect(starsForSolve(1, 1)).toBe(2);
    expect(starsForSolve(2, 2)).toBe(1);
    expect(starsForSolve(5, 2)).toBe(1);
    expect(starsForSolve(3, 5)).toBe(1);
  });
  it('constants match the spec', () => {
    expect(STARS_TO_UNLOCK_WORLD).toBe(30);
    expect(TOTAL_STARS).toBe(360);
  });
});

describe('unlock rules', () => {
  // the 30-star gate needs full 20-level worlds
  const big: LevelDef[] = [];
  for (let w = 1; w <= 2; w++) for (let n = 1; n <= 20; n++) big.push({ id: `w${w}-${String(n).padStart(2, '0')}`, world: w, n });
  it('world 1 open, world 2 needs exactly 30 stars from world 1', () => {
    expect(isWorldUnlocked(1, {}, big)).toBe(true);
    expect(isWorldUnlocked(2, {}, big)).toBe(false);
    const full = Object.fromEntries(big.filter((d) => d.world === 1).map((d) => [d.id, 3])); // 60
    expect(worldStars(full, 1, big)).toBe(60);
    expect(isWorldUnlocked(2, full, big)).toBe(true);
    const thirty = Object.fromEntries(big.filter((d) => d.world === 1).map((d, i) => [d.id, i < 10 ? 3 : 0])); // 30
    expect(isWorldUnlocked(2, thirty, big)).toBe(true);
    const short = { ...thirty, 'w1-01': 2 }; // 29
    expect(worldStars(short, 1, big)).toBe(29);
    expect(isWorldUnlocked(2, short, big)).toBe(false);
  });
  it('levels unlock in order', () => {
    expect(isLevelUnlocked(defs[0], {}, defs)).toBe(true);
    expect(isLevelUnlocked(defs[1], {}, defs)).toBe(false);
    expect(isLevelUnlocked(defs[1], { 'w1-01': 1 }, defs)).toBe(true);
    expect(isLevelUnlocked(defs[3], { 'w1-01': 3, 'w1-02': 3, 'w1-03': 3 }, defs)).toBe(false); // world gate
  });
  it('next + current navigation', () => {
    expect(nextLevel(defs[0], defs)?.id).toBe('w1-02');
    expect(nextLevel(big.find((d) => d.id === 'w1-20') as LevelDef, big)?.id).toBe('w2-01');
    expect(nextLevel(big.find((d) => d.id === 'w2-20') as LevelDef, big)).toBeNull();
    expect(currentLevel({}, defs)?.id).toBe('w1-01');
    expect(currentLevel({ 'w1-01': 3 }, defs)?.id).toBe('w1-02');
    const done = Object.fromEntries(defs.map((d) => [d.id, 3]));
    expect(currentLevel(done, defs)?.id).toBe('w2-01'); // fixture worlds: 18 < 30, so w2 stays the next goal
    expect(totalStars(done)).toBe(18);
  });
});

describe('progress schema', () => {
  it('empty default validates', () => {
    expect(parseProgress(emptyProgress())).toEqual(emptyProgress());
  });
  it('corrupt input resets cleanly', () => {
    expect(parseProgress(null)).toBeNull();
    expect(parseProgress({ version: 2, stars: {}, hints: {} })).toBeNull();
    expect(parseProgress({ version: 1, stars: { 'w1-01': 9 }, hints: {} })).toBeNull();
    expect(parseProgress({ version: 1, stars: { nope: 2 }, hints: {} })).toBeNull();
    expect(parseProgress({ version: 1, stars: { 'w1-01': 2 } })).toEqual({ version: 1, stars: { 'w1-01': 2 }, hints: {} });
    expect(loadProgress()).toEqual(emptyProgress()); // no window in node
  });
  it('record keeps the best', () => {
    let p = recordLevel(emptyProgress(), 'w1-01', 2, 1);
    expect(p.stars['w1-01']).toBe(2);
    p = recordLevel(p, 'w1-01', 1, 0); // worse: ignored
    expect(p.stars['w1-01']).toBe(2);
    p = recordLevel(p, 'w1-01', 3, 0); // better: kept
    expect(p.stars['w1-01']).toBe(3);
  });
  it('export/import round-trips, garbage throws', () => {
    const p = recordLevel(recordLevel(emptyProgress(), 'w1-01', 3, 0), 'w2-05', 2, 1);
    const code = exportProgress(p);
    expect(typeof code).toBe('string');
    expect(code).not.toContain(' ');
    expect(importProgress(code)).toEqual(p);
    expect(() => importProgress('!!!not-a-code!!!')).toThrow();
    expect(() => importProgress('')).toThrow();
  });
});

describe('feedback chips', () => {
  it('Apple vs Tesla: same country+type, different sector, equal cap', () => {
    const chips = feedbackChips({ name: 'Apple', class: 'stock' }, { name: 'Tesla', class: 'stock' });
    expect(chips.find((c) => c.kind === 'sector')).toMatchObject({ mark: 'no' });
    expect(chips.find((c) => c.kind === 'country')).toMatchObject({ mark: 'yes' });
    expect(chips.find((c) => c.kind === 'type')).toMatchObject({ mark: 'yes' });
    expect(chips.find((c) => c.kind === 'cap')).toMatchObject({ mark: 'eq' });
  });
  it('small guess vs Apple: cap points up, sectors differ', () => {
    const chips = feedbackChips({ name: 'Dogecoin (DOGE)', class: 'crypto' }, { name: 'Apple', class: 'stock' });
    expect(chips.find((c) => c.kind === 'cap')).toMatchObject({ mark: 'up', text: 'Cap ▲' });
    expect(chips.find((c) => c.kind === 'type')).toMatchObject({ mark: 'no' });
  });
  it('unknown assets give ? chips, never answer values', () => {
    const chips = feedbackChips({ name: 'Nope', class: 'stock' }, { name: 'Apple', class: 'stock' });
    expect(chips.filter((c) => c.mark === 'unknown').length).toBeGreaterThan(0);
    for (const c of chips) expect(c.text).not.toContain('Apple');
  });
  it('flags', () => {
    expect(flag('US')).toBe('🇺🇸');
    expect(flag('--')).toBe('🌐');
    expect(metaFor('Apple')?.ticker).toBe('AAPL');
    expect(metaFor('Nope')).toBeNull();
  });
});

describe('levels share', () => {
  it('exact format', () => {
    expect(shareLevelText(2, 3, 3, 'example.com/Wick/')).toBe('Wick · Level 23 ★★★\nexample.com/Wick/');
    expect(shareLevelText(1, 1, 1, 'x')).toBe('Wick · Level 1 ★☆☆\nx');
    expect(levelNumber(6, 20)).toBe(120);
    expect(starString(2)).toBe('★★☆');
  });
});
