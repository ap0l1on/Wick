// Levels progress: localStorage with schema validation, corrupt-state reset,
// and export/import codes for moving between devices. No accounts.
export interface Progress {
  version: 1;
  /** best stars per level id (0–3) */
  stars: Record<string, number>;
  /** hints used on the best run per level id (display only) */
  hints: Record<string, number>;
}

export const PROGRESS_KEY = 'wick.progress.v1';
const ID_RE = /^w[1-6]-[0-9]{2}$/;

export function emptyProgress(): Progress {
  return { version: 1, stars: {}, hints: {} };
}

function cleanRecord(v: unknown, max: number): Record<string, number> | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (!ID_RE.test(k) || typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > max) return null;
    out[k] = n;
  }
  return out;
}

/** Validate unknown data into Progress; null when corrupt. */
export function parseProgress(v: unknown): Progress | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (o.version !== 1) return null;
  const stars = cleanRecord(o.stars, 3);
  if (!stars) return null;
  const hints = cleanRecord(o.hints ?? {}, 5);
  if (!hints) return null;
  return { version: 1, stars, hints };
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(PROGRESS_KEY);
  } catch {
    return null;
  }
}

/** Load progress; corrupt or missing storage resets cleanly to empty. */
export function loadProgress(): Progress {
  const raw = readRaw();
  if (!raw) return emptyProgress();
  try {
    const p = parseProgress(JSON.parse(raw));
    return p ?? emptyProgress();
  } catch {
    return emptyProgress();
  }
}

/** Record a finished level; keeps the best stars. Returns the new progress. */
export function recordLevel(prev: Progress, id: string, stars: number, hintsUsed: number): Progress {
  const s = Math.min(Math.max(Math.floor(stars), 0), 3);
  const h = Math.min(Math.max(Math.floor(hintsUsed), 0), 5);
  const best = prev.stars[id] ?? 0;
  if (s <= best && (prev.hints[id] ?? 99) <= h) return prev;
  const next: Progress = {
    version: 1,
    stars: { ...prev.stars },
    hints: { ...prev.hints },
  };
  if (s >= best) {
    next.stars[id] = s;
    next.hints[id] = h;
  }
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked — progress lives in memory for this session */
  }
  return next;
}

/** Copy/paste code for moving progress to another device. */
export function exportProgress(p: Progress): string {
  const json = JSON.stringify({ version: 1, stars: p.stars, hints: p.hints });
  const bin = Array.from(new TextEncoder().encode(json), (b) => String.fromCharCode(b)).join('');
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Parse an export code; throws with a human message on invalid input. */
export function importProgress(code: string): Progress {
  const norm = code.trim().replace(/-/g, '+').replace(/_/g, '/');
  let json: string;
  try {
    const bin = atob(norm);
    json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    throw new Error('That code is not valid progress. Check for typos and try again.');
  }
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    throw new Error('That code is not valid progress. Check for typos and try again.');
  }
  const p = parseProgress(v);
  if (!p) throw new Error('That code is not valid progress. Check for typos and try again.');
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* storage blocked */
  }
  return p;
}
