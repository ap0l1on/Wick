// Puzzle loading — M2.1, M1.4. Answer is XOR-obfuscated, never in DOM pre-reveal.
// Imports the browser-safe deobfuscate from scripts/transform (do not copy).
import { deobfuscate } from '../../scripts/transform.ts';

export interface Puzzle {
  day: number;
  date: string;
  difficulty: 1 | 2 | 3;
  chart: { d: string[]; v: number[] };
  hints: string[]; // 5 pre-computed
  answer: string; // obfuscated payload
}

export interface Answer {
  key: string;
  asset: string;
  title: string;
  aliases: string[];
  story: string;
  tvUrl: string;
}

export const OBF_KEY = 'wick-v1';

export async function loadPuzzles(base: string = import.meta.env.BASE_URL): Promise<{ puzzles: Puzzle[] }> {
  const url = `${base.replace(/\/$/, '')}/puzzles.json`;
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`puzzles.json ${res.status}`);
  const data = (await res.json()) as { puzzles: Puzzle[] };
  if (!Array.isArray(data.puzzles)) throw new Error('bad puzzles.json');
  return data;
}

export function decodeAnswer(p: Puzzle): Answer {
  const raw = deobfuscate(p.answer, OBF_KEY + p.day);
  const v = JSON.parse(raw) as Answer;
  if (typeof v.asset !== 'string' || typeof v.title !== 'string') throw new Error('bad answer');
  return v;
}

export function findPuzzle(puzzles: Puzzle[], day: number): Puzzle | null {
  return puzzles.find((p) => p.day === day) ?? null;
}
