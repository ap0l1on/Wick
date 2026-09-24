// Builds public/puzzles.json (dailies) and public/levels/w1..w6.json (levels mode)
// from data/puzzles.catalog.json + data/levels.catalog.json.
// Runs ONLY inside GitHub Actions (.github/workflows/build-puzzles.yml) on GitHub's servers.
// Nobody runs it on their own computer; it needs no API key.
//   npx tsx scripts/build-puzzles.ts            # build, fail loudly if any puzzle isn't as extreme as claimed
//   npx tsx scripts/build-puzzles.ts --swap     # replace failing puzzles with a passing reserve of the same class
// Needs: npm i yahoo-finance2
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { clean, stats, check, downsample, normalize, candles, spoilerViolations, moveHint, yearsHint, obfuscate, type Expect, type RawPoint } from './transform.ts';

// yahoo-finance2 v4: default export is a class (v2's singleton is gone).
const { default: YahooFinance } = await import('yahoo-finance2');
const yf = new YahooFinance();

interface Item {
  key: string; answer: string; title: string; asset: string; aliases: string[]; class: string; symbol: string;
  start: string; end: string; expect: Expect; hintSector: string; hintClue: string; story: string;
  difficulty: 1 | 2 | 3; day?: number; date?: string; tv?: string; tvUrl?: string;
}
const CLASS_LABEL: Record<string, string> = { crypto: 'Cryptocurrency', stock: 'Stock', index: 'Stock market index', commodity: 'Commodity', currency: 'Currency pair', etf: 'Fund (ETF)' };
const OBF_KEY = 'wick-v1'; // public on purpose: this only stops casual peeking

const catalog = JSON.parse(readFileSync('data/puzzles.catalog.json', 'utf8')) as { launch: string; puzzles: Item[]; reserves: Item[] };
const swap = process.argv.includes('--swap');

async function fetchDaily(symbol: string, start: string, end: string): Promise<RawPoint[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let res: any, lastErr: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {           // retry with backoff: 2s, 4s, 8s
    try { res = await yf.chart(symbol, { period1: start, period2: end, interval: '1d' }); break; }
    catch (e) { lastErr = e; if (attempt < 4) await new Promise(r => setTimeout(r, 1000 * 2 ** attempt)); }
  }
  if (!res) throw lastErr;
  return clean(res.quotes.map((q: { date: Date; close: number | null; adjclose?: number | null; open?: number | null; high?: number | null; low?: number | null }) => {
    const close = (q.adjclose ?? q.close) as number; // split-adjusted where available
    return {
      date: q.date.toISOString().slice(0, 10),
      close,
      open: (q.open ?? close) as number,
      high: (q.high ?? close) as number,
      low: (q.low ?? close) as number,
    };
  }));
}

type Built = { ok: true; item: Item; out: Record<string, unknown>; note: string } | { ok: false; item: Item; note: string };

async function build(item: Item): Promise<Built> {
  try {
    const raw = await fetchDaily(item.symbol, item.start, item.end);
    const s = stats(raw);
    const fails = check(s, item.expect);
    if (fails.length) return { ok: false, item, note: fails.join('; ') };
    const shape = normalize(downsample(raw, 120));
    return {
      ok: true, item, note: `rise ${s.rise.multiple.toFixed(1)}x, dd ${(s.drawdown.pct * 100).toFixed(0)}%, cliff ${(s.cliff.pct * 100).toFixed(0)}%, ${raw.length} days`,
      out: {
        day: item.day, date: item.date, difficulty: item.difficulty,
        // line shape (v) + candlesticks; old clients ignore `candles`
        chart: { ...shape, candles: candles(raw) },
        hints: [CLASS_LABEL[item.class], yearsHint(s), moveHint(s, item.expect), item.hintSector, item.hintClue],
        answer: obfuscate(JSON.stringify({ key: item.key, asset: item.asset, title: item.title, aliases: item.aliases, story: item.story, tvUrl: item.tvUrl }), OBF_KEY + item.day),
      },
    };
  } catch (e) {
    return { ok: false, item, note: `fetch/parse error: ${(e as Error).message}` };
  }
}

/** Build items with a small worker pool so the log shows live progress and the
 *  run takes minutes, not half an hour. Workers pull from a shared queue;
 *  each fetch keeps its own retries, so one slow symbol never blocks the rest. */
async function buildAll<T extends { answer: string; day?: number }, R extends { ok: boolean; note: string }>(
  items: T[],
  label: string,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const CONCURRENCY = 5;
  const out: R[] = new Array(items.length);
  const total = items.length;
  let next = 0;
  let done = 0;
  async function worker(): Promise<void> {
    while (next < total) {
      const i = next++;
      const item = items[i];
      const r = await fn(item);
      out[i] = r;
      done++;
      const day = item.day ?? '-';
      console.log(`[${label} ${done}/${total}] day ${day} ${item.answer} ${r.ok ? 'PASS' : 'FAIL'} — ${r.note}`);
      await new Promise((res) => setTimeout(res, 200)); // pacing between requests
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()));
  return out;
}
const results: Built[] = await buildAll(catalog.puzzles, 'puzzle', build);
const reserveResults: Built[] = await buildAll(catalog.reserves, 'reserve', build);

const usable = reserveResults.filter(r => r.ok) as Extract<Built, { ok: true }>[];
const final: Record<string, unknown>[] = [];
const shippedDailies: { id: string; symbol: string; from: string; to: string; date: string }[] = [];
const report: string[] = ['| Day | Date | Answer | Symbol | Result | Note |', '| --- | --- | --- | --- | --- | --- |'];
for (const r of results) {
  if (r.ok) {
    final.push(r.out);
    report.push(`| ${r.item.day} | ${r.item.date} | ${r.item.answer} | ${r.item.symbol} | PASS | ${r.note} |`);
    shippedDailies.push({ id: `day ${r.item.day}`, symbol: r.item.symbol, from: r.item.start, to: r.item.end, date: r.item.date as string });
    continue;
  }
  report.push(`| ${r.item.day} | ${r.item.date} | ${r.item.answer} | ${r.item.symbol} | FAIL | ${r.note} |`);
  if (swap) {
    const i = usable.findIndex(u => u.item.class === r.item.class) >= 0 ? usable.findIndex(u => u.item.class === r.item.class) : 0;
    const sub = usable.splice(i, 1)[0];
    if (sub) {
      const rebuilt = await build({ ...sub.item, day: r.item.day, date: r.item.date });
      console.log(`[swap] day ${r.item.day} ↳ ${sub.item.answer} ${rebuilt.ok ? 'SWAPPED IN' : 'STILL FAILING'} — ${rebuilt.note}`);
      if (rebuilt.ok) {
        final.push(rebuilt.out);
        report.push(`| ${r.item.day} | ${r.item.date} | ↳ ${sub.item.answer} | ${sub.item.symbol} | SWAPPED IN | ${rebuilt.note} |`);
        shippedDailies.push({ id: `day ${r.item.day}`, symbol: sub.item.symbol, from: sub.item.start, to: sub.item.end, date: r.item.date as string });
      }
    }
  }
}
report.push('', '**Reserves**', '', '| Answer | Symbol | Result | Note |', '| --- | --- | --- | --- |', ...reserveResults.map(r => `| ${r.item.answer} | ${r.item.symbol} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.note} |`));

mkdirSync('public', { recursive: true });
writeFileSync('public/puzzles.json', JSON.stringify({ version: 1, launch: catalog.launch, puzzles: final.sort((a, b) => (a.day as number) - (b.day as number)) }));
writeFileSync('data/build-report.md', report.join('\n') + '\n');
const failed = results.filter(r => !r.ok).length;
console.log(`${results.length - failed}/${results.length} puzzles passed; ${usable.length} reserves unused. Report: data/build-report.md`);
if (final.length < catalog.puzzles.length) process.exit(1);

// ---------- Levels mode ----------
interface LevelItem {
  id: string; world: number; n: number; asset: string; symbol: string;
  from: string; to: string; expect: Expect; difficulty: number; fact: string;
}
interface AssetMeta { ticker: string; country: string; sector: string; cap: number }
const COUNTRY_NAME: Record<string, string> = {
  US: 'USA', CN: 'China', JP: 'Japan', DE: 'Germany', GB: 'UK', CA: 'Canada',
  BR: 'Brazil', TR: 'Türkiye', IN: 'India', AU: 'Australia', CH: 'Switzerland',
  HK: 'Hong Kong', FI: 'Finland', SG: 'Singapore', RU: 'Russia', AR: 'Argentina',
  '--': 'Global',
};

const levelCatalog = JSON.parse(readFileSync('data/levels.catalog.json', 'utf8')) as {
  worlds: { id: number; name: string; theme: string }[]; levels: LevelItem[];
};
const assetsMeta = JSON.parse(readFileSync('data/assets.json', 'utf8')) as Record<string, AssetMeta>;
const guessClass = new Map<string, string>(
  (JSON.parse(readFileSync('data/guess-list.json', 'utf8')) as { name: string; class: string }[]).map((e) => [e.name, e.class]),
);

// Structural validation first: fail loudly before burning fetch time.
const levelErrors: string[] = [];
for (const w of levelCatalog.worlds) {
  const inWorld = levelCatalog.levels.filter((l) => l.world === w.id);
  if (inWorld.length !== 20) levelErrors.push(`world ${w.id} has ${inWorld.length} levels, want 20`);
  const ns = inWorld.map((l) => l.n).sort((a, b) => a - b).join(',');
  if (ns !== Array.from({ length: 20 }, (_, i) => i + 1).join(',')) levelErrors.push(`world ${w.id} n is not 1..20`);
}
const seenIds = new Set<string>();
for (const l of levelCatalog.levels) {
  if (seenIds.has(l.id)) levelErrors.push(`duplicate id ${l.id}`);
  seenIds.add(l.id);
  if (l.id !== `w${l.world}-${String(l.n).padStart(2, '0')}`) levelErrors.push(`bad id ${l.id}`);
  if (!(l.difficulty >= 1 && l.difficulty <= 5)) levelErrors.push(`${l.id} difficulty out of 1-5`);
  if (!l.fact) levelErrors.push(`${l.id} empty fact`);
  if (!guessClass.has(l.asset)) levelErrors.push(`${l.id} asset not in guess-list: ${l.asset}`);
  if (!assetsMeta[l.asset]) levelErrors.push(`${l.id} asset missing metadata: ${l.asset}`);
  if (!(l.from < l.to)) levelErrors.push(`${l.id} bad window ${l.from}..${l.to}`);
}
if (levelErrors.length) {
  console.error(`LEVEL CATALOG ERRORS:\n${levelErrors.join('\n')}`);
  process.exit(1);
}

// Spoiler rule: no level may be a daily scheduled in the next 60 days.
const todayISO = new Date().toISOString().slice(0, 10);
const shipped = shippedDailies;
const violations = spoilerViolations(
  levelCatalog.levels.map((l) => ({ id: l.id, symbol: l.symbol, from: l.from, to: l.to })),
  shipped,
  todayISO,
);
if (violations.length) {
  console.error(`SPOILER VIOLATIONS:\n${violations.join('\n')}`);
  process.exit(1);
}
console.log(`spoiler check clean (${levelCatalog.levels.length} levels vs ${shipped.length} dailies)`);

type LevelBuilt =
  | { ok: true; item: LevelItem; out: Record<string, unknown>; note: string }
  | { ok: false; item: LevelItem; note: string };

async function buildLevel(item: LevelItem): Promise<LevelBuilt> {
  try {
    const raw = await fetchDaily(item.symbol, item.from, item.to);
    const s = stats(raw);
    const fails = check(s, item.expect);
    if (fails.length) return { ok: false, item, note: fails.join('; ') };
    const shape = normalize(downsample(raw, 120));
    const cls = guessClass.get(item.asset) as string;
    const meta = assetsMeta[item.asset];
    const geo = `${COUNTRY_NAME[meta.country] ?? meta.country} · ${CLASS_LABEL[cls]}`;
    return {
      ok: true, item,
      note: `rise ${s.rise.multiple.toFixed(1)}x, dd ${(s.drawdown.pct * 100).toFixed(0)}%, cliff ${(s.cliff.pct * 100).toFixed(0)}%, ${raw.length} days`,
      out: {
        id: item.id, world: item.world, n: item.n, difficulty: item.difficulty,
        chart: { ...shape, candles: candles(raw) },
        hints: [meta.sector, yearsHint(s), geo],
        answer: obfuscate(JSON.stringify({ asset: item.asset, fact: item.fact }), OBF_KEY + item.id),
      },
    };
  } catch (e) {
    return { ok: false, item, note: `fetch/parse error: ${(e as Error).message}` };
  }
}

const levelResults: LevelBuilt[] = await buildAll(
  levelCatalog.levels.map((l) => ({ ...l, answer: l.asset })),
  'level',
  (x) => buildLevel(x),
);
const levelFailed = levelResults.filter((r) => !r.ok);
report.push('', '**Levels**', '', '| Level | World | Answer | Symbol | Result | Note |', '| --- | --- | --- | --- | --- | --- |');
for (const r of levelResults) {
  const it = r.item as LevelItem;
  report.push(`| ${it.id} | ${it.world} | ${it.asset} | ${it.symbol} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.note} |`);
}
writeFileSync('data/build-report.md', report.join('\n') + '\n');
if (levelFailed.length) {
  console.error(`${levelFailed.length} levels failed; see data/build-report.md`);
  process.exit(1);
}
mkdirSync('public/levels', { recursive: true });
const worldIndex: { id: number; name: string; theme: string; levels: string[] }[] = [];
for (const w of levelCatalog.worlds) {
  const outs = levelResults
    .filter((r) => r.ok)
    .map((r) => (r as Extract<LevelBuilt, { ok: true }>).out)
    .filter((o) => (o.world as number) === w.id)
    .sort((a, b) => ((a.n as number) - (b.n as number)));
  writeFileSync(`public/levels/w${w.id}.json`, JSON.stringify({ version: 1, world: w, levels: outs }));
  worldIndex.push({ id: w.id, name: w.name, theme: w.theme, levels: outs.map((o) => o.id as string) });
}
writeFileSync('public/levels/index.json', JSON.stringify({ version: 1, worlds: worldIndex }));
console.log(`${levelResults.length}/${levelResults.length} levels passed; public/levels/w1..w6.json written.`);
