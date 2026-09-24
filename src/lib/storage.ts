// localStorage with try/catch + schema checks — M1.3, M8 gate.
const PREFIX = 'wick:';

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    /* storage full / blocked — game still works in-memory */
  }
}

export interface DayGame {
  guesses: { name: string; class: string; tile: 'right' | 'near' | 'wrong' }[];
  finished: boolean;
  won: boolean;
  answerAsset?: string;
}

export interface Stats {
  played: number;
  wins: number;
  streak: number;
  maxStreak: number;
  dist: number[]; // index 0..4 = wins in 1..5, index 5 = losses (X)
  lastDay: number; // last day counted for streak
}

const EMPTY_STATS: Stats = { played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0], lastDay: 0 };

function validGame(v: unknown): v is DayGame {
  if (typeof v !== 'object' || v === null) return false;
  const g = v as Record<string, unknown>;
  if (!Array.isArray(g.guesses)) return false;
  if (typeof g.finished !== 'boolean' || typeof g.won !== 'boolean') return false;
  for (const x of g.guesses) {
    const r = x as Record<string, unknown>;
    if (typeof r.name !== 'string' || typeof r.class !== 'string') return false;
    if (r.tile !== 'right' && r.tile !== 'near' && r.tile !== 'wrong') return false;
  }
  if (g.guesses.length > 5) return false;
  return true;
}

function validStats(v: unknown): v is Stats {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  if (typeof s.played !== 'number' || typeof s.wins !== 'number') return false;
  if (typeof s.streak !== 'number' || typeof s.maxStreak !== 'number') return false;
  if (!Array.isArray(s.dist) || s.dist.length !== 6) return false;
  if (typeof s.lastDay !== 'number') return false;
  if (s.played < 0 || s.wins < 0 || s.wins > s.played) return false;
  return true;
}

export const store = {
  loadGame(day: number): DayGame | null {
    const raw = safeGet(`game:${day}`);
    if (!raw) return null;
    try {
      const v: unknown = JSON.parse(raw);
      if (!validGame(v)) return null;
      return v;
    } catch {
      return null;
    }
  },
  saveGame(day: number, g: DayGame): void {
    safeSet(`game:${day}`, JSON.stringify(g));
  },
  loadStats(): Stats {
    const raw = safeGet('stats');
    if (!raw) return { ...EMPTY_STATS, dist: [...EMPTY_STATS.dist] };
    try {
      const v: unknown = JSON.parse(raw);
      if (!validStats(v)) return { ...EMPTY_STATS, dist: [...EMPTY_STATS.dist] };
      return v;
    } catch {
      return { ...EMPTY_STATS, dist: [...EMPTY_STATS.dist] };
    }
  },
  saveStats(s: Stats): void {
    safeSet('stats', JSON.stringify(s));
  },
  /** Apply a finished game to stats. Skipped days break the streak. */
  applyResult(prev: Stats, day: number, won: boolean, guessCount: number): Stats {
    const s: Stats = { ...prev, dist: [...prev.dist] };
    // Streak break on skipped day: if lastDay is neither 0 nor day-1 nor day, reset.
    if (s.lastDay !== 0 && s.lastDay !== day - 1 && s.lastDay !== day) {
      s.streak = 0;
    }
    // Avoid double-counting the same day (reload after finish).
    // Caller must only call once; guard via lastDay+played is approximate,
    // so we rely on game.finished persistence in app code.
    s.played += 1;
    if (won) {
      s.wins += 1;
      s.streak = s.lastDay === day - 1 || s.lastDay === 0 || s.lastDay === day ? s.streak + 1 : 1;
      // consecutive-day streak: if lastDay was day-1 or fresh, increment; if same day replay, don't double
      if (s.lastDay === day) s.streak = prev.streak; // replay guard
      else if (!(s.lastDay === 0 || s.lastDay === day - 1)) s.streak = 1;
      else if (s.lastDay !== day) s.streak = prev.streak + 1;
      s.maxStreak = Math.max(s.maxStreak, s.streak);
      const idx = Math.min(Math.max(guessCount, 1), 5) - 1;
      s.dist[idx] += 1;
    } else {
      s.streak = 0;
      s.dist[5] += 1;
    }
    s.lastDay = day;
    return s;
  },
  getTheme(): 'dark' | 'light' | null {
    const v = safeGet('theme');
    return v === 'dark' || v === 'light' ? v : null;
  },
  setTheme(t: 'dark' | 'light'): void {
    safeSet('theme', t);
  },
  seenHowto(): boolean {
    return safeGet('seenHowto') === '1';
  },
  markHowto(): void {
    safeSet('seenHowto', '1');
  },
};
