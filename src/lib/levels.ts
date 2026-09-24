// Levels mode rules: stars, unlocking, world gates. Pure functions, tested in
// tests/levels.test.ts. No DOM, no storage (see lib/progress.ts).
export interface LevelDef {
  id: string;
  world: number;
  n: number;
}

export const WORLDS = 6;
export const LEVELS_PER_WORLD = 20;
export const STARS_TO_UNLOCK_WORLD = 30;
export const TOTAL_STARS = WORLDS * LEVELS_PER_WORLD * 3; // 360

export type Stars = 0 | 1 | 2 | 3;

/** Stars for a solve: 3 for 1–2 guesses, 2 for 3–4, 1 for 5. Each hint used
 *  caps the result one star lower; a solve always keeps at least 1. */
export function starsForSolve(guessesUsed: number, hintsUsed: number): Stars {
  const g = Math.min(Math.max(Math.floor(guessesUsed), 1), 5);
  const h = Math.min(Math.max(Math.floor(hintsUsed), 0), 3);
  const base: Stars = g <= 2 ? 3 : g <= 4 ? 2 : 1;
  return Math.max(1, base - h) as Stars;
}

/** Total stars earned in one world. */
export function worldStars(stars: Record<string, number>, world: number, defs: LevelDef[]): number {
  let total = 0;
  for (const d of defs) {
    if (d.world !== world) continue;
    const s = stars[d.id] ?? 0;
    if (s >= 1 && s <= 3) total += s;
  }
  return total;
}

/** Total stars across all worlds. */
export function totalStars(stars: Record<string, number>): number {
  let total = 0;
  for (const s of Object.values(stars)) {
    if (s >= 1 && s <= 3) total += s;
  }
  return total;
}

/** World 1 is always open; later worlds need 30 ★ from the previous world. */
export function isWorldUnlocked(world: number, stars: Record<string, number>, defs: LevelDef[]): boolean {
  if (world <= 1) return true;
  if (world > WORLDS) return false;
  return worldStars(stars, world - 1, defs) >= STARS_TO_UNLOCK_WORLD;
}

/** Level (w,1) needs its world open; later levels need any stars on the
 *  previous level. */
export function isLevelUnlocked(def: LevelDef, stars: Record<string, number>, defs: LevelDef[]): boolean {
  if (!isWorldUnlocked(def.world, stars, defs)) return false;
  if (def.n <= 1) return true;
  const prev = defs.find((d) => d.world === def.world && d.n === def.n - 1);
  if (!prev) return false;
  return (stars[prev.id] ?? 0) >= 1;
}

/** Next level in path order (across the world boundary), or null at the end. */
export function nextLevel(def: LevelDef, defs: LevelDef[]): LevelDef | null {
  if (def.n < LEVELS_PER_WORLD) {
    return defs.find((d) => d.world === def.world && d.n === def.n + 1) ?? null;
  }
  if (def.world < WORLDS) {
    return defs.find((d) => d.world === def.world + 1 && d.n === 1) ?? null;
  }
  return null;
}

/** Where the player continues: first unsolved unlocked level; if everything
 *  unlocked is solved, the first locked level (the next goal); null only when
 *  all 120 are solved. */
export function currentLevel(stars: Record<string, number>, defs: LevelDef[]): LevelDef | null {
  const ordered = [...defs].sort((a, b) => a.world - b.world || a.n - b.n);
  let firstLocked: LevelDef | null = null;
  for (const d of ordered) {
    if (!isLevelUnlocked(d, stars, defs)) {
      if (!firstLocked) firstLocked = d;
      continue;
    }
    if ((stars[d.id] ?? 0) < 1) return d;
  }
  return firstLocked;
}
