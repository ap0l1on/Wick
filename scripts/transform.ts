// Pure functions that turn a raw daily close series into a game-ready, normalized puzzle.
// No network, no I/O: unit-tested in tests/transform.test.ts.

export type Expect = { rise?: number; dd?: number; neg?: boolean; cliff?: number };
export interface RawPoint {
  date: string; close: number; // ISO date (YYYY-MM-DD), close in quote currency
  open?: number; high?: number; low?: number; // optional OHLC for candlesticks
}

export interface Stats {
  firstDate: string; lastDate: string; points: number;
  rise: { multiple: number; from: string; to: string; days: number };   // best low -> later high
  drawdown: { pct: number; from: string; to: string; days: number };    // worst peak -> later trough (0..1+)
  cliff: { pct: number; date: string };                                   // worst single-step drop (0..1+)
  wentNegative: boolean;
}

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

export function clean(points: RawPoint[]): RawPoint[] {
  const seen = new Set<string>();
  return points
    .filter(p => p && typeof p.close === 'number' && Number.isFinite(p.close) && /^\d{4}-\d{2}-\d{2}$/.test(p.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter(p => (seen.has(p.date) ? false : (seen.add(p.date), true)));
}

export function stats(points: RawPoint[]): Stats {
  if (points.length < 10) throw new Error(`too few points (${points.length})`);
  let lowI = 0, bestRise = { multiple: 1, i: 0, j: 0 };
  let peakI = 0, bestDd = { pct: 0, i: 0, j: 0 };
  let cliff = { pct: 0, i: 0 };
  let neg = false;
  for (let j = 0; j < points.length; j++) {
    const c = points[j].close;
    if (c < 0) neg = true;
    // rise: only meaningful from a positive low
    if (points[lowI].close > 0 && c / points[lowI].close > bestRise.multiple) bestRise = { multiple: c / points[lowI].close, i: lowI, j };
    if (c > 0 && (points[lowI].close <= 0 || c < points[lowI].close)) lowI = j;
    // drawdown from the running peak (can exceed 1 when price goes negative)
    if (points[peakI].close > 0) {
      const dd = (points[peakI].close - c) / points[peakI].close;
      if (dd > bestDd.pct) bestDd = { pct: dd, i: peakI, j };
    }
    if (c > points[peakI].close) peakI = j;
    if (j > 0 && points[j - 1].close > 0) {
      const drop = (points[j - 1].close - c) / points[j - 1].close;
      if (drop > cliff.pct) cliff = { pct: drop, i: j };
    }
  }
  const P = points;
  return {
    firstDate: P[0].date, lastDate: P[P.length - 1].date, points: P.length,
    rise: { multiple: bestRise.multiple, from: P[bestRise.i].date, to: P[bestRise.j].date, days: daysBetween(P[bestRise.i].date, P[bestRise.j].date) },
    drawdown: { pct: bestDd.pct, from: P[bestDd.i].date, to: P[bestDd.j].date, days: daysBetween(P[bestDd.i].date, P[bestDd.j].date) },
    cliff: { pct: cliff.pct, date: P[cliff.i].date },
    wentNegative: neg,
  };
}

/** Returns the list of failed expectations (empty = the chart is as extreme as the catalog claims). */
export function check(s: Stats, e: Expect): string[] {
  const f: string[] = [];
  if (e.rise !== undefined && s.rise.multiple < e.rise) f.push(`rise ${s.rise.multiple.toFixed(2)}x < ${e.rise}x`);
  if (e.dd !== undefined && s.drawdown.pct < e.dd) f.push(`drawdown ${(s.drawdown.pct * 100).toFixed(1)}% < ${e.dd * 100}%`);
  if (e.neg && !s.wentNegative) f.push('never went below zero');
  if (e.cliff !== undefined && s.cliff.pct < e.cliff) f.push(`worst one-step drop ${(s.cliff.pct * 100).toFixed(1)}% < ${e.cliff * 100}%`);
  return f;
}

/** Downsample to at most `max` points, always keeping the first, last, global max and global min. */
export function downsample(points: RawPoint[], max = 120): RawPoint[] {
  if (points.length <= max) return points;
  const keep = new Set<number>([0, points.length - 1]);
  let hi = 0, lo = 0;
  points.forEach((p, i) => { if (p.close > points[hi].close) hi = i; if (p.close < points[lo].close) lo = i; });
  keep.add(hi); keep.add(lo);
  const step = (points.length - 1) / (max - keep.size);
  for (let k = 0; keep.size < max && k * step < points.length; k++) keep.add(Math.round(k * step));
  return [...keep].sort((a, b) => a - b).map(i => points[i]);
}

/** Index to first point = 100, one decimal. Stores the shape only, never real price levels. */
export function normalize(points: RawPoint[]): { d: string[]; v: number[] } {
  const base = Math.abs(points[0].close) || 1;
  return { d: points.map(p => p.date), v: points.map(p => Math.round((p.close / base) * 1000) / 10) };
}

/** Bucket contiguous raw points into at most `max` candles, indexed like normalize().
 *  Falls back to closes when OHLC fields are missing (e.g. old data). */
export function candles(points: RawPoint[], max = 120): { d: string[]; o: number[]; h: number[]; l: number[]; c: number[] } {
  const base = Math.abs(points[0]?.close) || 1;
  const idx = (x: number): number => Math.round((x / base) * 1000) / 10;
  const size = Math.max(1, Math.ceil(points.length / Math.max(1, max)));
  const d: string[] = [];
  const o: number[] = [];
  const h: number[] = [];
  const l: number[] = [];
  const c: number[] = [];
  for (let b = 0; b * size < points.length; b++) {
    const slice = points.slice(b * size, (b + 1) * size);
    const first = slice[0];
    const last = slice[slice.length - 1];
    d.push(first.date);
    o.push(idx(first.open ?? first.close));
    h.push(idx(Math.max(...slice.map((p) => p.high ?? p.close))));
    l.push(idx(Math.min(...slice.map((p) => p.low ?? p.close))));
    c.push(idx(last.close));
  }
  return { d, o, h, l, c };
}

export interface DatedWindow { id: string; symbol: string; from: string; to: string; date: string }

/** Spoiler rule: no level may share a symbol + overlapping window with a daily
 *  scheduled within `horizonDays` after `today` (ISO dates). Returns violations. */
export function spoilerViolations(
  levels: { id: string; symbol: string; from: string; to: string }[],
  dailies: DatedWindow[],
  today: string,
  horizonDays = 60,
): string[] {
  const t = Date.parse(today);
  const out: string[] = [];
  for (const l of levels) {
    for (const d of dailies) {
      const ahead = Math.round((Date.parse(d.date) - t) / DAY);
      if (!Number.isFinite(ahead) || ahead < 0 || ahead > horizonDays) continue;
      if (l.symbol.toLowerCase() !== d.symbol.toLowerCase()) continue;
      if (l.from <= d.to && d.from <= l.to) {
        out.push(`${l.id} (${l.symbol} ${l.from}..${l.to}) overlaps daily ${d.id} (${d.date})`);
      }
    }
  }
  return out;
}

const pct = (x: number) => `${Math.round(x * 100).toLocaleString('en-US')}%`;
const span = (days: number) => (days <= 1 ? 'in one day' : days < 60 ? `in ${days} days` : days < 730 ? `in ${Math.round(days / 30.4)} months` : `in ${(days / 365).toFixed(1)} years`);

/** Hint 3 text, chosen from the expectation the puzzle is famous for. */
export function moveHint(s: Stats, e: Expect): string {
  if (e.neg) return 'It went below zero.';
  if (e.cliff !== undefined) return `−${pct(s.cliff.pct)} in a single day.`;
  const rise = e.rise !== undefined ? `+${pct(s.rise.multiple - 1)} ${span(s.rise.days)}` : '';
  const dd = e.dd !== undefined ? `−${pct(Math.min(s.drawdown.pct, 1))} from the top ${span(s.drawdown.days)}` : '';
  return [rise, dd].filter(Boolean).join(', then ') + '.';
}

export function yearsHint(s: Stats): string {
  const a = s.firstDate.slice(0, 4), b = s.lastDate.slice(0, 4);
  return a === b ? a : `${a}–${b}`;
}

/** Light obfuscation so answers aren't readable in the network tab. Not security: the repo is public.
 *  Uses only btoa/atob + TextEncoder so the same code runs in Node 18+ and in the browser. */
export function obfuscate(text: string, key: string): string {
  const t = new TextEncoder().encode(text), k = new TextEncoder().encode(key);
  let bin = '';
  t.forEach((b, i) => { bin += String.fromCharCode(b ^ k[i % k.length]); });
  return btoa(bin);
}
export function deobfuscate(b64: string, key: string): string {
  const bin = atob(b64), k = new TextEncoder().encode(key);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) ^ k[i % k.length];
  return new TextDecoder().decode(out);
}
