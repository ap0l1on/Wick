// Levels data loading: tiny index for unlock math, per-world files lazily.
import type { LevelDef } from './levels.ts';
import { deobfuscate } from '../../scripts/transform.ts';

export interface WorldMeta {
  id: number;
  name: string;
  theme: string;
}

export const WORLD_META: WorldMeta[] = [
  { id: 1, name: 'Blue Chips', theme: 'Household names with famous shapes' },
  { id: 2, name: 'Crashes', theme: 'Famous crashes' },
  { id: 3, name: 'Moonshots', theme: 'Explosions upward' },
  { id: 4, name: 'Crypto', theme: 'Coins and crypto stocks' },
  { id: 5, name: 'World Markets', theme: 'Indices, FX, commodities, non-US' },
  { id: 6, name: 'Legends', theme: 'Hard mode: short windows' },
];

export interface CandleData {
  d: string[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
}

export interface ChartData {
  d: string[];
  v: number[];
  candles?: CandleData;
}

export interface LevelJson extends LevelDef {
  difficulty: number;
  chart: ChartData;
  hints: string[]; // [sector, year, geo]
  answer: string; // obfuscated { asset, fact }
}

export interface LevelAnswer {
  asset: string;
  fact: string;
}

export const LEVEL_OBF_PREFIX = 'wick-v1';

const worldCache = new Map<number, LevelJson[]>();

export async function loadIndex(base: string = import.meta.env.BASE_URL): Promise<{ worlds: WorldMeta[]; defs: LevelDef[] }> {
  const url = `${base.replace(/\/$/, '')}/levels/index.json`;
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`index.json ${res.status}`);
  const data = (await res.json()) as {
    worlds: { id: number; name: string; theme: string; levels: string[] }[];
  };
  if (!Array.isArray(data.worlds)) throw new Error('bad index.json');
  const defs: LevelDef[] = [];
  for (const w of data.worlds) {
    for (const id of w.levels) {
      const m = /^w(\d+)-(\d+)$/.exec(id);
      if (m) defs.push({ id, world: Number(m[1]), n: Number(m[2]) });
    }
  }
  return { worlds: data.worlds.map((w) => ({ id: w.id, name: w.name, theme: w.theme })), defs };
}

export async function loadWorld(world: number, base: string = import.meta.env.BASE_URL): Promise<LevelJson[]> {
  const hit = worldCache.get(world);
  if (hit) return hit;
  const url = `${base.replace(/\/$/, '')}/levels/w${world}.json`;
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`w${world}.json ${res.status}`);
  const data = (await res.json()) as { levels: LevelJson[] };
  if (!Array.isArray(data.levels)) throw new Error(`bad w${world}.json`);
  worldCache.set(world, data.levels);
  return data.levels;
}

export function clearWorldCache(): void {
  worldCache.clear();
}

export function decodeLevelAnswer(level: LevelJson): LevelAnswer {
  const v = JSON.parse(deobfuscate(level.answer, LEVEL_OBF_PREFIX + level.id)) as LevelAnswer;
  if (typeof v.asset !== 'string' || typeof v.fact !== 'string') throw new Error('bad level answer');
  return v;
}
